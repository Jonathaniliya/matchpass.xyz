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
      items: true,
    },
  });
  if (!order) throw new Error(`order_not_found:${orderId}`);

  const qrExpiresAt = new Date(
    order.event.startsAt.getTime() + QR_EXPIRY_HOURS_AFTER_EVENT * 60 * 60 * 1000,
  );

  const issued: IssuedTicket[] = [];

  for (const item of order.items) {
    await tx.ticketType.update({
      where: { id: item.ticketTypeId },
      data: {
        quantityReserved: { decrement: item.quantity },
        quantitySold: { increment: item.quantity },
      },
    });

    for (let i = 0; i < item.quantity; i++) {
      const ticket = await tx.ticket.create({
        data: {
          orderItemId: item.id,
          eventId: order.eventId,
          fanId: order.fanId,
          status: "issued",
        },
      });
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
