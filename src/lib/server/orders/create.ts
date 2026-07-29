import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db/prisma";
import { createOrderDepositAddress } from "@/lib/server/circle/clubWallet";
import type { CreateOrderInput } from "@/lib/shared/schemas/order";

const ORDER_EXPIRY_MINUTES = Number(process.env.ORDER_EXPIRY_MINUTES ?? "15");

export type CreateOrderResult = {
  orderId: string;
  depositAddress: string;
  totalUsdc: string;
  expiresAt: Date;
};

type AreaSnapshot = {
  id: string;
  admissionType: "general_admission" | "reserved_seating";
  sectionLabel: string | null;
  rowLabel: string | null;
  entranceLabel: string | null;
  accessInstructions: string | null;
};

export async function createOrder(params: {
  fanId: string;
  input: CreateOrderInput;
}): Promise<CreateOrderResult> {
  const { fanId, input } = params;

  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    include: { club: true, ticketTypes: { select: { id: true, ticketAreaId: true } } },
  });
  if (!event) throw new OrderError("event_not_found", 404);
  if (event.status !== "on_sale") throw new OrderError("event_not_on_sale", 409);

  const ticketTypeMap = new Map(event.ticketTypes.map((type) => [type.id, type]));
  const selectedTypes = input.items.map((item) => {
    const ticketType = ticketTypeMap.get(item.ticketTypeId);
    if (!ticketType) throw new OrderError("ticket_type_invalid", 400);
    return ticketType;
  });
  const ticketAreaId = selectedTypes[0]?.ticketAreaId;
  if (!ticketAreaId || selectedTypes.some((type) => type.ticketAreaId !== ticketAreaId)) {
    throw new OrderError("single_area_required", 400);
  }

  // The only remote call (Circle address creation) happens after this short
  // database transaction. The area row is locked first, then ticket types are
  // locked in a stable order, which prevents overselling and deadlocks.
  const placeholderAddress = `pending:${cryptoRandom()}`;
  const expiresAt = new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000);
  const totalQuantity = input.items.reduce((total, item) => total + item.quantity, 0);

  let totalUsdc = new Prisma.Decimal(0);
  const orderId = await prisma.$transaction(async (tx) => {
    const areas = await tx.$queryRaw<AreaSnapshot[]>(Prisma.sql`
      UPDATE "TicketArea"
      SET
        "quantityReserved" = "quantityReserved" + ${totalQuantity},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${ticketAreaId}
        AND "eventId" = ${event.id}
        AND "isActive" = true
        AND "maxPerOrder" >= ${totalQuantity}
        AND "quantityReserved" + "quantitySold" + ${totalQuantity} <= "quantityTotal"
        AND EXISTS (
          SELECT 1 FROM "Event"
          WHERE "Event"."id" = ${event.id}
            AND "Event"."status" = 'on_sale'
        )
      RETURNING
        "id", "admissionType", "sectionLabel", "rowLabel", "entranceLabel", "accessInstructions"
    `);
    const area = areas[0];
    if (!area) throw new OrderError("ticket_area_unavailable", 409);

    const items: Array<{
      ticketTypeId: string;
      quantity: number;
      unitPriceUsdc: Prisma.Decimal;
      ticketTypeName: string;
      isTransferable: boolean;
    }> = [];

    for (const item of [...input.items].sort((a, b) =>
      a.ticketTypeId.localeCompare(b.ticketTypeId),
    )) {
      const reserved = await tx.$queryRaw<
        Array<{
          id: string;
          priceUsdc: Prisma.Decimal;
          name: string;
          isTransferable: boolean;
        }>
      >(Prisma.sql`
        UPDATE "TicketType"
        SET
          "quantityReserved" = "quantityReserved" + ${item.quantity},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${item.ticketTypeId}
          AND "eventId" = ${event.id}
          AND "ticketAreaId" = ${ticketAreaId}
          AND "isActive" = true
          AND ("salesStartAt" IS NULL OR "salesStartAt" <= CURRENT_TIMESTAMP)
          AND ("salesEndAt" IS NULL OR "salesEndAt" > CURRENT_TIMESTAMP)
          AND "maxPerOrder" >= ${item.quantity}
          AND "quantityReserved" + "quantitySold" + ${item.quantity} <= "quantityTotal"
        RETURNING "id", "name", "priceUsdc", "isTransferable"
      `);
      const ticketType = reserved[0];
      if (!ticketType) throw new OrderError("ticket_type_unavailable", 409);

      const unitPriceUsdc = new Prisma.Decimal(ticketType.priceUsdc);
      totalUsdc = totalUsdc.add(unitPriceUsdc.mul(item.quantity));
      items.push({
        ticketTypeId: ticketType.id,
        quantity: item.quantity,
        unitPriceUsdc,
        ticketTypeName: ticketType.name,
        isTransferable: ticketType.isTransferable,
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
      },
    });

    const orderItems: Array<{ id: string; quantity: number }> = [];
    for (const item of items) {
      const orderItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          ticketTypeId: item.ticketTypeId,
          quantity: item.quantity,
          unitPriceUsdc: item.unitPriceUsdc,
          ticketTypeName: item.ticketTypeName,
          admissionType: area.admissionType,
          sectionLabel: area.sectionLabel,
          rowLabel: area.rowLabel,
          entranceLabel: area.entranceLabel,
          accessInstructions: area.accessInstructions,
          isTransferable: item.isTransferable,
        },
        select: { id: true },
      });
      orderItems.push({ id: orderItem.id, quantity: item.quantity });
    }

    if (area.admissionType === "reserved_seating") {
      const seats = await findAdjacentAvailableSeats(tx, ticketAreaId, totalQuantity);
      if (seats.length !== totalQuantity) {
        throw new OrderError("adjacent_seats_unavailable", 409);
      }

      let offset = 0;
      for (const item of orderItems) {
        const seatIds = seats.slice(offset, offset + item.quantity).map((seat) => seat.id);
        offset += item.quantity;
        const assigned = await tx.ticketSeat.updateMany({
          where: {
            id: { in: seatIds },
            ticketAreaId,
            status: "available",
          },
          data: { status: "reserved", orderItemId: item.id },
        });
        if (assigned.count !== seatIds.length) {
          throw new OrderError("reserved_seats_unavailable", 409);
        }
      }
    }

    return order.id;
  });

  let deposit: { walletId: string; address: string };
  try {
    deposit = await createOrderDepositAddress({ clubId: event.clubId, orderRefId: orderId });
  } catch (error) {
    await releaseOrder(orderId).catch(() => undefined);
    throw error;
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { depositAddress: deposit.address, depositAddressKeyId: deposit.walletId },
  });

  return {
    orderId: updated.id,
    depositAddress: updated.depositAddress,
    totalUsdc: updated.totalUsdc.toString(),
    expiresAt: updated.expiresAt,
  };
}

async function findAdjacentAvailableSeats(
  tx: Prisma.TransactionClient,
  ticketAreaId: string,
  quantity: number,
) {
  return tx.$queryRaw<Array<{ id: string; sortOrder: number }>>(Prisma.sql`
    WITH "available" AS (
      SELECT
        "id",
        "sortOrder",
        "sortOrder" - ROW_NUMBER() OVER (ORDER BY "sortOrder", "id") AS "run"
      FROM "TicketSeat"
      WHERE "ticketAreaId" = ${ticketAreaId}
        AND "status" = 'available'
    ),
    "firstRun" AS (
      SELECT "run"
      FROM "available"
      GROUP BY "run"
      HAVING COUNT(*) >= ${quantity}
      ORDER BY MIN("sortOrder")
      LIMIT 1
    )
    SELECT "id", "sortOrder"
    FROM "available"
    WHERE "run" = (SELECT "run" FROM "firstRun")
    ORDER BY "sortOrder", "id"
    LIMIT ${quantity}
  `);
}

export async function releaseOrder(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { ticketType: { select: { ticketAreaId: true } } } } },
    });
    if (!order) return;
    const expired = await tx.order.updateMany({
      where: { id: order.id, status: "pending" },
      data: { status: "expired" },
    });
    if (expired.count !== 1) return;

    const areaReleases = new Map<string, number>();
    for (const item of [...order.items].sort((a, b) =>
      a.ticketTypeId.localeCompare(b.ticketTypeId),
    )) {
      await tx.ticketSeat.updateMany({
        where: { orderItemId: item.id, status: "reserved" },
        data: { status: "available", orderItemId: null },
      });
      const released = await tx.ticketType.updateMany({
        where: { id: item.ticketTypeId, quantityReserved: { gte: item.quantity } },
        data: { quantityReserved: { decrement: item.quantity } },
      });
      if (released.count !== 1) throw new Error("inventory_release_invariant_failed");
      const areaId = item.ticketType.ticketAreaId;
      areaReleases.set(areaId, (areaReleases.get(areaId) ?? 0) + item.quantity);
    }
    for (const [ticketAreaId, quantity] of [...areaReleases].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const released = await tx.ticketArea.updateMany({
        where: { id: ticketAreaId, quantityReserved: { gte: quantity } },
        data: { quantityReserved: { decrement: quantity } },
      });
      if (released.count !== 1) throw new Error("inventory_release_invariant_failed");
    }
  });
}

export class OrderError extends Error {
  constructor(
    code: string,
    readonly status = 400,
  ) {
    super(code);
    this.name = "OrderError";
  }
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
