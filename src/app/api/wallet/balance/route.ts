import { NextResponse } from "next/server";
import { requireFan } from "@/lib/server/auth/requireFan";
import { prisma } from "@/lib/server/db/prisma";

type CircleTokenBalance = {
  token: { name: string; symbol: string; decimals: number };
  amount: string;
  updateDate: string;
};

export async function GET() {
  const fan = await requireFan();

  const wallet = await prisma.fanCircleWallet.findUnique({
    where: { fanId: fan.id },
    select: { walletId: true, address: true, chain: true },
  });

  if (!wallet) {
    return NextResponse.json({ address: null, balances: [] });
  }

  try {
    const baseUrl = process.env.CIRCLE_BASE_URL ?? "https://api.circle.com";
    const apiKey = process.env.CIRCLE_API_KEY;
    if (!apiKey) throw new Error("CIRCLE_API_KEY not set");

    const resp = await fetch(
      `${baseUrl}/v1/w3s/wallets/${wallet.walletId}/balances`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );

    if (!resp.ok) {
      return NextResponse.json({ address: wallet.address, balances: [] });
    }

    const data = await resp.json();
    const balances = (
      (data?.data?.tokenBalances as CircleTokenBalance[]) ?? []
    ).map((b) => ({ symbol: b.token.symbol, amount: b.amount }));

    return NextResponse.json({ address: wallet.address, balances });
  } catch {
    return NextResponse.json({ address: wallet.address, balances: [] });
  }
}
