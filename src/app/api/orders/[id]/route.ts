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
  const order = await prisma.order.findUnique({ where: { id } });
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
  });
}
