import { NextResponse } from "next/server";
import { requireFan } from "@/lib/server/auth/requireFan";
import { createWalletProvisioningChallenge } from "@/lib/server/circle/fanWallet";

export async function POST() {
  const fan = await requireFan();
  try {
    const result = await createWalletProvisioningChallenge(fan.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("wallet_init_failed", err);
    return NextResponse.json(
      { error: "wallet_init_failed" },
      { status: 500 },
    );
  }
}
