import { NextResponse, type NextRequest } from "next/server";
import { getCurrentFan } from "@/lib/server/auth/requireFan";
import {
  createFanWalletTransfer,
  WalletTransferError,
} from "@/lib/server/circle/fanTransfers";
import { createWalletTransferSchema } from "@/lib/shared/schemas/wallet";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const fan = await getCurrentFan();
  if (!fan) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createWalletTransferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_transfer", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await createFanWalletTransfer({
      fanId: fan.id,
      input: parsed.data,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof WalletTransferError) {
      return NextResponse.json(
        { error: error.code, details: error.details },
        { status: error.status },
      );
    }
    console.error("fan_wallet_transfer_challenge_failed", {
      fanId: fan.id,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      { error: "transfer_challenge_failed" },
      { status: 502 },
    );
  }
}
