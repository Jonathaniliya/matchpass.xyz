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

    // Lock inventory in a consistent order. Each conditional UPDATE performs
    // availability checking and reservation atomically, preventing concurrent
    // checkouts from overselling the final tickets.
    for (const item of [...input.items].sort((a, b) =>
      a.ticketTypeId.localeCompare(b.ticketTypeId),
    )) {
      const reserved = await tx.$queryRaw<
        Array<{ id: string; priceUsdc: Prisma.Decimal; maxPerOrder: number }>
      >(Prisma.sql`
        UPDATE "TicketType"
        SET
          "quantityReserved" = "quantityReserved" + ${item.quantity},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${item.ticketTypeId}
          AND "eventId" = ${event.id}
          AND "isActive" = true
          AND ("salesStartAt" IS NULL OR "salesStartAt" <= CURRENT_TIMESTAMP)
          AND ("salesEndAt" IS NULL OR "salesEndAt" > CURRENT_TIMESTAMP)
          AND "maxPerOrder" >= ${item.quantity}
          AND "quantityReserved" + "quantitySold" + ${item.quantity} <= "quantityTotal"
          AND EXISTS (
            SELECT 1 FROM "Event"
            WHERE "Event"."id" = ${event.id}
              AND "Event"."status" = 'on_sale'
          )
        RETURNING "id", "priceUsdc", "maxPerOrder"
      `);
      const ticketType = reserved[0];
      if (!ticketType) {
        throw new OrderError("ticket_type_unavailable", 409);
      }

      const unitPriceUsdc = new Prisma.Decimal(ticketType.priceUsdc);
      const lineTotal = unitPriceUsdc.mul(item.quantity);
      totalUsdc = totalUsdc.add(lineTotal);
      items.push({
        ticketTypeId: ticketType.id,
        quantity: item.quantity,
        unitPriceUsdc,
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
    const expired = await tx.order.updateMany({
      where: { id: order.id, status: "pending" },
      data: { status: "expired" },
    });
    if (expired.count !== 1) return;

    for (const item of [...order.items].sort((a, b) =>
      a.ticketTypeId.localeCompare(b.ticketTypeId),
    )) {
      const released = await tx.ticketType.updateMany({
        where: {
          id: item.ticketTypeId,
          quantityReserved: { gte: item.quantity },
        },
        data: { quantityReserved: { decrement: item.quantity } },
      });
      if (released.count !== 1) throw new Error("inventory_release_invariant_failed");
    }
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
