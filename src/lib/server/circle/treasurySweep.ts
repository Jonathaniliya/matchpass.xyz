import type { Balance as CircleBalance } from "@circle-fin/developer-controlled-wallets";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db/prisma";
import { CIRCLE_CHAIN, getCircleDcwClient } from "./client";

const ARC_USDC_TOKEN_ADDRESS = (
  process.env.CIRCLE_ARC_USDC_TOKEN_ADDRESS ??
  "0x3600000000000000000000000000000000000000"
).toLowerCase();

export async function processTreasurySweep(sweepId: string): Promise<void> {
  const claimed = await prisma.treasurySweep.updateMany({
    where: {
      id: sweepId,
      status: { in: ["pending", "failed"] },
    },
    data: { status: "submitting", failureReason: null },
  });
  if (claimed.count !== 1) return;

  const sweep = await prisma.treasurySweep.findUnique({
    where: { id: sweepId },
  });
  if (!sweep) return;

  try {
    const client = getCircleDcwClient();
    const balances = await client.getWalletTokenBalance({
      id: sweep.sourceWalletId,
      includeAll: true,
    });
    const usdc = selectUsdcBalance(balances.data?.tokenBalances ?? []);
    if (!usdc) throw new Error("source_wallet_usdc_balance_unavailable");

    const available = new Prisma.Decimal(usdc.amount);
    const intended = sweep.amountUsdc;
    const estimate = await client.estimateTransferFee({
      walletId: sweep.sourceWalletId,
      destinationAddress: await getTreasuryAddress(sweep.destinationWalletId),
      amount: [intended.toFixed(6)],
      tokenId: usdc.token.id,
    });
    const networkFee = new Prisma.Decimal(
      estimate.data?.medium?.networkFee ?? "0",
    );
    const transferable = available.sub(networkFee);
    const amount = Prisma.Decimal.min(intended, transferable);
    if (amount.lte(0)) throw new Error("source_wallet_balance_below_network_fee");

    const transaction = await client.createTransaction({
      walletId: sweep.sourceWalletId,
      destinationAddress: await getTreasuryAddress(sweep.destinationWalletId),
      amount: [amount.toFixed(6)],
      tokenId: usdc.token.id,
      refId: sweep.id,
      idempotencyKey: `treasury-sweep:${sweep.id}`,
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });
    const providerTransactionId = transaction.data?.id;
    if (!providerTransactionId) throw new Error("circle_sweep_transaction_missing");

    await prisma.treasurySweep.update({
      where: { id: sweep.id },
      data: {
        status: "submitted",
        providerTransactionId,
        tokenId: usdc.token.id,
        sweptAmountUsdc: amount,
        networkFeeUsdc: networkFee,
        submittedAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.treasurySweep.update({
      where: { id: sweep.id },
      data: {
        status: "failed",
        failureReason: (error instanceof Error ? error.message : "unknown_error").slice(0, 500),
      },
    });
    console.error("treasury_sweep_failed", {
      sweepId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }
}

export async function getClubTreasuryUsdcBalance(clubId: string) {
  const account = await prisma.clubCircleAccount.findUnique({
    where: { clubId },
    select: { walletId: true, chain: true },
  });
  if (!account) {
    return { address: null, chain: null, amount: "0.000000", symbol: "USDC" };
  }

  const client = getCircleDcwClient();
  const wallet = await client.getWallet({ id: account.walletId });
  const balances = await client.getWalletTokenBalance({
    id: account.walletId,
    includeAll: true,
  });
  const usdc = selectUsdcBalance(balances.data?.tokenBalances ?? []);
  return {
    address: wallet.data?.wallet?.address ?? null,
    chain: account.chain,
    amount: usdc?.amount ?? "0.000000",
    symbol: "USDC",
  };
}

async function getTreasuryAddress(walletId: string) {
  const client = getCircleDcwClient();
  const response = await client.getWallet({ id: walletId });
  const address = response.data?.wallet?.address;
  if (!address) throw new Error("treasury_wallet_address_unavailable");
  return address;
}

function selectUsdcBalance(balances: CircleBalance[]) {
  const onChain = balances.filter(
    (balance) => balance.token.blockchain === CIRCLE_CHAIN,
  );
  return (
    onChain.find(
      (balance) =>
        balance.token.tokenAddress?.toLowerCase() === ARC_USDC_TOKEN_ADDRESS,
    ) ??
    onChain.find((balance) => balance.token.symbol?.toUpperCase() === "USDC")
  );
}
