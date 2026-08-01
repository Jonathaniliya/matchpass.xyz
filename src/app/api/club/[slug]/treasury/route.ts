import { NextResponse } from "next/server";
import { canManageClub, getClubApiAccess } from "@/lib/server/auth/clubAccess";
import { getClubTreasuryUsdcBalance } from "@/lib/server/circle/treasurySweep";
import { prisma } from "@/lib/server/db/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const authorization = await getClubApiAccess(slug);
  if (!authorization.authenticated) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!authorization.access || !canManageClub(authorization.access.role)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const [balance, recentSweeps] = await Promise.all([
      getClubTreasuryUsdcBalance(authorization.access.clubId),
      prisma.treasurySweep.findMany({
        where: { clubId: authorization.access.clubId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          amountUsdc: true,
          sweptAmountUsdc: true,
          createdAt: true,
          completedAt: true,
        },
      }),
    ]);
    return NextResponse.json({
      ...balance,
      recentSweeps: recentSweeps.map((sweep) => ({
        ...sweep,
        amountUsdc: sweep.amountUsdc.toFixed(6),
        sweptAmountUsdc: sweep.sweptAmountUsdc?.toFixed(6) ?? null,
      })),
    });
  } catch (error) {
    console.error("club_treasury_balance_failed", {
      clubId: authorization.access.clubId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      { error: "treasury_balance_unavailable" },
      { status: 502 },
    );
  }
}
