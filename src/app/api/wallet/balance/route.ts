import { NextResponse } from "next/server";
import { getCurrentFan } from "@/lib/server/auth/requireFan";
import { getFanUsdcWallet } from "@/lib/server/circle/fanTransfers";

export const runtime = "nodejs";

export async function GET() {
  const fan = await getCurrentFan();
  if (!fan) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const wallet = await getFanUsdcWallet(fan.id);
    if (!wallet) {
      return NextResponse.json({
        address: null,
        chain: null,
        balances: [],
        usdc: null,
      });
    }

    const usdc = wallet.balance
      ? {
          symbol: wallet.balance.symbol,
          amount: wallet.balance.amount,
          tokenId: wallet.balance.tokenId,
          tokenAddress: wallet.balance.tokenAddress,
          decimals: wallet.balance.decimals,
        }
      : null;

    return NextResponse.json({
      address: wallet.address,
      chain: wallet.chain,
      balances: usdc ? [{ symbol: usdc.symbol, amount: usdc.amount }] : [],
      usdc,
    });
  } catch (error) {
    console.error("fan_wallet_balance_failed", {
      fanId: fan.id,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      { error: "wallet_balance_unavailable" },
      { status: 502 },
    );
  }
}
