import type { Prisma } from "@prisma/client";
import { buildQrPayload, deriveQrToken } from "./qrToken";

const QR_EXPIRY_HOURS_AFTER_EVENT = Number(process.env.QR_EXPIRY_HOURS_AFTER_EVENT ?? "6");

export type IssuedTicket = {
  ticketId: string;
  qrPayload: string;
};

export async function issueTicketsForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<IssuedTicket[]> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      event: true,
      items: { include: { ticketType: true, seats: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!order) throw new Error(`order_not_found:${orderId}`);

  const qrExpiresAt = new Date(
    order.event.startsAt.getTime() + QR_EXPIRY_HOURS_AFTER_EVENT * 60 * 60 * 1000,
  );

  const issued: IssuedTicket[] = [];

  for (const item of order.items) {
    const admissionType = item.admissionType ?? item.ticketType.admissionType;
    if (
      admissionType === "reserved_seating" &&
      item.seats.length !== item.quantity
    ) {
      throw new Error("reserved_seat_assignment_invariant_failed");
    }

    await tx.ticketType.update({
      where: { id: item.ticketTypeId },
      data: {
        quantityReserved: { decrement: item.quantity },
        quantitySold: { increment: item.quantity },
      },
    });

    for (let i = 0; i < item.quantity; i++) {
      const seat = item.seats[i] ?? null;
      const ticket = await tx.ticket.create({
        data: {
          orderItemId: item.id,
          eventId: order.eventId,
          fanId: order.fanId,
          status: "issued",
          seatId: seat?.id ?? null,
          ticketTypeName: item.ticketTypeName ?? item.ticketType.name,
          admissionType,
          sectionLabel: seat?.sectionLabel ?? item.sectionLabel ?? item.ticketType.sectionLabel,
          rowLabel: seat?.rowLabel ?? item.rowLabel ?? item.ticketType.rowLabel,
          seatLabel: seat?.seatNumber ?? null,
          entranceLabel: item.entranceLabel ?? item.ticketType.entranceLabel,
          accessInstructions:
            item.accessInstructions ?? item.ticketType.accessInstructions,
          isTransferable: item.isTransferable,
        },
      });
      if (seat) {
        const sold = await tx.ticketSeat.updateMany({
          where: {
            id: seat.id,
            orderItemId: item.id,
            status: "reserved",
          },
          data: { status: "sold" },
        });
        if (sold.count !== 1) {
          throw new Error("reserved_seat_sale_invariant_failed");
        }
      }
      const { token, tokenHash } = deriveQrToken(ticket.id);
      await tx.qrToken.create({
        data: {
          ticketId: ticket.id,
          tokenHash,
          status: "active",
          expiresAt: qrExpiresAt,
        },
      });
      issued.push({ ticketId: ticket.id, qrPayload: buildQrPayload(ticket.id, token) });
    }
  }

  return issued;
}
