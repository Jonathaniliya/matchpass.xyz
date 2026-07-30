import type { Balance as CircleBalance } from "@circle-fin/user-controlled-wallets";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db/prisma";
import type { CreateWalletTransferInput } from "@/lib/shared/schemas/wallet";
import { syncFanWalletFromCircle } from "./fanWallet";
import { getCircleUcwClient } from "./ucwClient";

const ARC_USDC_TOKEN_ADDRESS = (
  process.env.CIRCLE_ARC_USDC_TOKEN_ADDRESS ??
  "0x3600000000000000000000000000000000000000"
).toLowerCase();

export type FanUsdcWallet = {
  localWalletId: string;
  walletId: string;
  address: string;
  chain: string;
  userToken: string;
  encryptionKey: string;
  balance: {
    amount: string;
    tokenId: string;
    tokenAddress: string | null;
    decimals: number;
    symbol: "USDC";
  } | null;
};

export async function getFanUsdcWallet(fanId: string): Promise<FanUsdcWallet | null> {
  let wallet = await prisma.fanCircleWallet.findUnique({
    where: { fanId },
    select: { id: true, walletId: true, address: true, chain: true },
  });

  if (!wallet) {
    await syncFanWalletFromCircle(fanId);
    wallet = await prisma.fanCircleWallet.findUnique({
      where: { fanId },
      select: { id: true, walletId: true, address: true, chain: true },
    });
  }
  if (!wallet) return null;

  const client = getCircleUcwClient();
  const tokenResponse = await client.createUserToken({ userId: fanId });
  const userToken = tokenResponse.data?.userToken;
  const encryptionKey = tokenResponse.data?.encryptionKey;
  if (!userToken || !encryptionKey) {
    throw new WalletTransferError("circle_credentials_unavailable", 502);
  }

  const balanceResponse = await client.getWalletTokenBalance({
    walletId: wallet.walletId,
    userToken,
    includeAll: true,
  });
  const tokenBalances = balanceResponse.data?.tokenBalances ?? [];
  const usdc = selectUsdcBalance(tokenBalances, wallet.chain);

  return {
    localWalletId: wallet.id,
    walletId: wallet.walletId,
    address: wallet.address,
    chain: wallet.chain,
    userToken,
    encryptionKey,
    balance: usdc
      ? {
          amount: usdc.amount,
          tokenId: usdc.token.id,
          tokenAddress: usdc.token.tokenAddress ?? null,
          decimals: usdc.token.decimals ?? 6,
          symbol: "USDC",
        }
      : null,
  };
}

export async function createFanWalletTransfer(params: {
  fanId: string;
  input: CreateWalletTransferInput;
}) {
  const { fanId, input } = params;
  const wallet = await getFanUsdcWallet(fanId);
  if (!wallet) throw new WalletTransferError("wallet_not_setup", 409);
  if (!wallet.balance) throw new WalletTransferError("usdc_balance_unavailable", 409);

  let orderId: string | null = null;
  let destinationAddress: string;
  let amount: Prisma.Decimal;

  if (input.purpose === "order_payment") {
    const order = await prisma.order.findFirst({
      where: { id: input.orderId, fanId },
      select: {
        id: true,
        status: true,
        totalUsdc: true,
        depositAddress: true,
        expiresAt: true,
      },
    });
    if (!order) throw new WalletTransferError("order_not_found", 404);
    if (order.status !== "pending") {
      throw new WalletTransferError("order_not_pending", 409);
    }
    if (order.expiresAt.getTime() <= Date.now()) {
      throw new WalletTransferError("order_expired", 409);
    }
    orderId = order.id;
    destinationAddress = order.depositAddress;
    amount = order.totalUsdc;
  } else {
    destinationAddress = input.destinationAddress;
    amount = new Prisma.Decimal(input.amount);
  }

  if (destinationAddress.toLowerCase() === wallet.address.toLowerCase()) {
    throw new WalletTransferError("destination_is_your_wallet", 400);
  }

  const available = new Prisma.Decimal(wallet.balance.amount);
  if (amount.gt(available)) {
    throw new WalletTransferError("insufficient_usdc_balance", 409, {
      available: available.toFixed(6),
      required: amount.toFixed(6),
    });
  }

  const client = getCircleUcwClient();
  let networkFeeUsdc: string | null = null;
  try {
    const estimate = await client.estimateTransferFee({
      userToken: wallet.userToken,
      amount: [amount.toFixed(6)],
      destinationAddress,
      walletId: wallet.walletId,
      tokenId: wallet.balance.tokenId,
    });
    networkFeeUsdc = estimate.data?.medium?.networkFee ?? null;
  } catch (error) {
    console.warn("fan_wallet_fee_estimate_failed", {
      fanId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }

  if (networkFeeUsdc) {
    const requiredWithFee = amount.add(new Prisma.Decimal(networkFeeUsdc));
    if (requiredWithFee.gt(available)) {
      throw new WalletTransferError("insufficient_usdc_for_amount_and_fee", 409, {
        available: available.toFixed(6),
        required: requiredWithFee.toFixed(6),
        networkFee: networkFeeUsdc,
      });
    }
  }

  const idempotencyKey = crypto.randomUUID();
  const attempt = await prisma.fanWalletTransfer.create({
    data: {
      fanId,
      fanCircleWalletId: wallet.localWalletId,
      orderId,
      purpose: input.purpose,
      destinationAddress,
      amountUsdc: amount,
      tokenId: wallet.balance.tokenId,
      idempotencyKey,
    },
    select: { id: true },
  });

  try {
    const transaction = await client.createTransaction({
      userToken: wallet.userToken,
      amounts: [amount.toFixed(6)],
      destinationAddress,
      walletId: wallet.walletId,
      tokenId: wallet.balance.tokenId,
      refId: attempt.id,
      idempotencyKey,
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });
    const challengeId = transaction.data?.challengeId;
    if (!challengeId) throw new Error("Circle did not return a challenge ID");

    await prisma.fanWalletTransfer.update({
      where: { id: attempt.id },
      data: { challengeId, challengeStatus: "pending" },
    });

    return {
      attemptId: attempt.id,
      challengeId,
      userToken: wallet.userToken,
      encryptionKey: wallet.encryptionKey,
      transfer: {
        purpose: input.purpose,
        destinationAddress,
        amountUsdc: amount.toFixed(6),
        networkFeeUsdc,
        chain: wallet.chain,
      },
    };
  } catch (error) {
    await prisma.fanWalletTransfer.update({
      where: { id: attempt.id },
      data: {
        challengeStatus: "creation_failed",
        failureReason: safeFailureReason(error),
        challengeUpdatedAt: new Date(),
      },
    });
    throw error;
  }
}

function selectUsdcBalance(
  balances: CircleBalance[],
  chain: string,
): CircleBalance | undefined {
  const onChain = balances.filter(
    (balance) => balance.token.blockchain === chain,
  );
  return (
    onChain.find(
      (balance) =>
        balance.token.tokenAddress?.toLowerCase() === ARC_USDC_TOKEN_ADDRESS,
    ) ??
    onChain.find((balance) => balance.token.symbol?.toUpperCase() === "USDC")
  );
}

function safeFailureReason(error: unknown) {
  return (error instanceof Error ? error.message : "unknown_error").slice(0, 500);
}

export class WalletTransferError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details?: Record<string, string>,
  ) {
    super(code);
    this.name = "WalletTransferError";
  }
}
