import { NextResponse } from "next/server";
import { getCurrentOrGuestFan } from "@/lib/server/auth/requireFan";
import { prisma } from "@/lib/server/db/prisma";
import { buildQrPayload, deriveQrToken } from "@/lib/server/tickets/qrToken";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const fan = await getCurrentOrGuestFan();
  if (!fan) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      event: { include: { club: true } },
      fan: { include: { wallet: true } },
      items: {
        include: {
          ticketType: true,
          tickets: { include: { qrToken: true } },
        },
      },
    },
  });

  if (!order || order.fanId !== fan.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.status !== "fulfilled") {
    return NextResponse.json(
      { error: "not_fulfilled", status: order.status },
      { status: 409 },
    );
  }

  const tickets: Array<{
    ticketId: string;
    ticketTypeName: string;
    seatLabel: string | null;
    qrPayload: string | null;
    qrStatus: "active" | "used" | "expired" | "revoked";
    expiresAt: string;
  }> = [];

  for (const item of order.items) {
    for (const ticket of item.tickets) {
      const qr = ticket.qrToken;
      if (!qr) continue;

      if (qr.status !== "active") {
        tickets.push({
          ticketId: ticket.id,
          ticketTypeName: item.ticketType.name,
          seatLabel: ticket.seatLabel,
          qrPayload: null,
          qrStatus: qr.status,
          expiresAt: qr.expiresAt.toISOString(),
        });
        continue;
      }

      const { token } = deriveQrToken(ticket.id);

      tickets.push({
        ticketId: ticket.id,
        ticketTypeName: item.ticketType.name,
        seatLabel: ticket.seatLabel,
        qrPayload: buildQrPayload(ticket.id, token),
        qrStatus: qr.status,
        expiresAt: qr.expiresAt.toISOString(),
      });
    }
  }

  const walletAddr = order.fan.wallet?.address ?? null;
  const walletShort = walletAddr
    ? `${walletAddr.slice(0, 6)}…${walletAddr.slice(-4)}`
    : null;

  return NextResponse.json({
    orderId: order.id,
    eventName: order.event.name,
    clubName: order.event.club.name,
    venue: order.event.venue,
    startsAt: order.event.startsAt.toISOString(),
    holder: {
      email: order.fan.email,
      walletShort,
    },
    tickets,
  });
}
