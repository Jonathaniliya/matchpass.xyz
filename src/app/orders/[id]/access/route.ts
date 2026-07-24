import { NextResponse } from "next/server";
import {
  setGuestFanCookie,
  verifyAccessToken,
} from "@/lib/server/auth/guestSession";
import { getCurrentFan } from "@/lib/server/auth/requireFan";
import { prisma } from "@/lib/server/db/prisma";

export const runtime = "nodejs";

// Magic-link entry from the ticket-ready email.
// Verifies the signed token, sets the guest cookie, redirects to the order page.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  if (!token) {
    return NextResponse.redirect(new URL(`/orders/${id}`, url.origin));
  }

  const fanId = verifyAccessToken(token);
  if (!fanId) {
    return NextResponse.redirect(
      new URL(`/orders/${id}?error=invalid_link`, url.origin),
    );
  }

  // Verify the fan actually owns this order before granting cookie access.
  const order = await prisma.order.findUnique({
    where: { id },
    select: { fanId: true, fan: { select: { supabaseUserId: true } } },
  });
  if (!order || order.fanId !== fanId) {
    return NextResponse.redirect(
      new URL(`/orders/${id}?error=invalid_link`, url.origin),
    );
  }

  if (order.fan.supabaseUserId) {
    const currentFan = await getCurrentFan();
    if (currentFan?.id === fanId) {
      return NextResponse.redirect(new URL(`/orders/${id}/tickets`, url.origin));
    }

    const returnTo = `${url.pathname}${url.search}`;
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(returnTo)}`, url.origin),
    );
  }

  await setGuestFanCookie(fanId);
  return NextResponse.redirect(new URL(`/orders/${id}/tickets`, url.origin));
}
