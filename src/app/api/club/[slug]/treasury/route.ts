import { NextResponse } from "next/server";
import { canManageClub, getClubApiAccess } from "@/lib/server/auth/clubAccess";
import { getClubTreasuryUsdcBalance } from "@/lib/server/circle/treasurySweep";

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
    const balance = await getClubTreasuryUsdcBalance(
      authorization.access.clubId,
    );
    return NextResponse.json(balance);
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
