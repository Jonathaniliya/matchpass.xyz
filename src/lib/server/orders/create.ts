import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db/prisma";
import { createOrderDepositAddress } from "@/lib/server/circle/clubWallet";
import type { CreateOrderInput } from "@/lib/shared/schemas/order";

const ORDER_EXPIRY_MINUTES = Number(process.env.ORDER_EXPIRY_MINUTES ?? "60");

export type CreateOrderResult = {
  orderId: string;
  depositAddress: string;
  totalUsdc: string;
  expiresAt: Date;
};

export async function createOrder(params: {
  fanId: string;
  input: CreateOrderInput;
}): Promise<CreateOrderResult> {
  const { fanId, input } = params;

  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    include: { club: true, ticketTypes: true },
  });
  if (!event) throw new OrderError("event_not_found", 404);
  if (event.status !== "on_sale") throw new OrderError("event_not_on_sale", 409);

  const ticketTypeMap = new Map(event.ticketTypes.map((t) => [t.id, t]));
  for (const item of input.items) {
    if (!ticketTypeMap.has(item.ticketTypeId)) {
      throw new OrderError("ticket_type_invalid", 400);
    }
  }

  // 1) Reserve inventory transactionally + create skeleton order with placeholder address.
  // We mint a real DCW address AFTER reservation succeeds (Circle call is slow,
  // and we don't want to hold a DB transaction open during a remote round-trip).
  const placeholderAddress = `pending:${cryptoRandom()}`;
  const expiresAt = new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000);

  let totalUsdc = new Prisma.Decimal(0);
  const orderId = await prisma.$transaction(async (tx) => {
    const items: Array<{ ticketTypeId: string; quantity: number; unitPriceUsdc: Prisma.Decimal }> = [];

    for (const item of input.items) {
      const tt = await tx.ticketType.findUnique({ where: { id: item.ticketTypeId } });
      if (!tt) throw new OrderError("ticket_type_invalid", 400);
      const remaining = tt.quantityTotal - tt.quantityReserved - tt.quantitySold;
      if (remaining < item.quantity) {
        throw new OrderError("not_enough_inventory", 409);
      }
      await tx.ticketType.update({
        where: { id: tt.id },
        data: { quantityReserved: { increment: item.quantity } },
      });
      const lineTotal = tt.priceUsdc.mul(item.quantity);
      totalUsdc = totalUsdc.add(lineTotal);
      items.push({
        ticketTypeId: tt.id,
        quantity: item.quantity,
        unitPriceUsdc: tt.priceUsdc,
      });
    }

    const order = await tx.order.create({
      data: {
        fanId,
        eventId: event.id,
        status: "pending",
        totalUsdc,
        depositAddress: placeholderAddress,
        expiresAt,
        items: { create: items },
      },
    });
    return order.id;
  });

  // 2) Mint a fresh Circle DCW deposit address for this order (outside the tx).
  let deposit: { walletId: string; address: string };
  try {
    deposit = await createOrderDepositAddress({
      clubId: event.clubId,
      orderRefId: orderId,
    });
  } catch (err) {
    // Roll back the inventory reservation if Circle fails.
    await releaseOrder(orderId).catch(() => undefined);
    throw err;
  }

  // 3) Patch the order with the real deposit address.
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      depositAddress: deposit.address,
      depositAddressKeyId: deposit.walletId,
    },
  });

  return {
    orderId: updated.id,
    depositAddress: updated.depositAddress,
    totalUsdc: updated.totalUsdc.toString(),
    expiresAt: updated.expiresAt,
  };
}

export async function releaseOrder(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return;
    if (order.status !== "pending") return;
    for (const item of order.items) {
      await tx.ticketType.update({
        where: { id: item.ticketTypeId },
        data: { quantityReserved: { decrement: item.quantity } },
      });
    }
    await tx.order.update({
      where: { id: order.id },
      data: { status: "expired" },
    });
  });
}

export class OrderError extends Error {
  status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = "OrderError";
    this.status = status;
  }
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
