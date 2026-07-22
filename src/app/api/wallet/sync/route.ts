import { NextResponse } from "next/server";
import { requireFan } from "@/lib/server/auth/requireFan";
import { syncFanWalletFromCircle } from "@/lib/server/circle/fanWallet";

export async function POST() {
  const fan = await requireFan();
  try {
    const wallet = await syncFanWalletFromCircle(fan.id);
    if (!wallet) {
      return NextResponse.json(
        { error: "no_wallet_yet" },
        { status: 404 },
      );
    }
    return NextResponse.json(wallet);
  } catch (err) {
    console.error("wallet_sync_failed", err);
    return NextResponse.json(
      { error: "wallet_sync_failed" },
      { status: 500 },
    );
  }
}
