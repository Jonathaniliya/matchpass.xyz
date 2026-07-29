import { NextResponse } from "next/server";
import { getCurrentOrGuestFan } from "@/lib/server/auth/requireFan";
import { prisma } from "@/lib/server/db/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const fan = await getCurrentOrGuestFan();
  if (!fan) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { id: "asc" },
        include: { seats: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!order || order.fanId !== fan.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    orderId: order.id,
    status: order.status,
    depositAddress: order.depositAddress,
    totalUsdc: order.totalUsdc.toString(),
    expiresAt: order.expiresAt,
    paidAt: order.paidAt,
    fulfilledAt: order.fulfilledAt,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.ticketTypeName ?? "Match ticket",
      quantity: item.quantity,
      unitPriceUsdc: item.unitPriceUsdc.toString(),
      admissionType: item.admissionType,
      sectionLabel: item.sectionLabel,
      rowLabel: item.rowLabel,
      entranceLabel: item.entranceLabel,
      seats: item.seats.map((seat) => seat.label),
    })),
  });
}
