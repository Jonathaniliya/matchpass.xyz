import { NextResponse, type NextRequest } from "next/server";
import { getCurrentFan } from "@/lib/server/auth/requireFan";
import { prisma } from "@/lib/server/db/prisma";
import { walletChallengeStatusSchema } from "@/lib/shared/schemas/wallet";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const fan = await getCurrentFan();
  if (!fan) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = walletChallengeStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const { attemptId } = await params;
  const updated = await prisma.fanWalletTransfer.updateMany({
    where: { id: attemptId, fanId: fan.id },
    data: {
      challengeStatus: parsed.data.status.toLowerCase(),
      failureReason:
        parsed.data.status === "COMPLETE" ? null : parsed.data.error ?? null,
      challengeUpdatedAt: new Date(),
    },
  });
  if (updated.count !== 1) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
