import { prisma } from "@/lib/server/db/prisma";
import { CIRCLE_CHAIN, getCircleDcwClient } from "./client";

export async function ensureClubCircleAccount(clubId: string) {
  const existing = await prisma.clubCircleAccount.findUnique({
    where: { clubId },
  });
  if (existing) return existing;

  const client = getCircleDcwClient();

  const walletSetResp = await client.createWalletSet({
    name: `club:${clubId}`,
  });
  const walletSet = walletSetResp.data?.walletSet;
  if (!walletSet) throw new Error("Failed to create Circle wallet set");

  const walletsResp = await client.createWallets({
    walletSetId: walletSet.id,
    blockchains: [CIRCLE_CHAIN],
    count: 1,
    accountType: "EOA",
    metadata: [{ name: `club-treasury:${clubId}` }],
  });
  const treasury = walletsResp.data?.wallets?.[0];
  if (!treasury) throw new Error("Failed to create club treasury wallet");

  return prisma.clubCircleAccount.create({
    data: {
      clubId,
      walletSetId: walletSet.id,
      walletId: treasury.id,
      chain: CIRCLE_CHAIN,
    },
  });
}

export async function createOrderDepositAddress(params: {
  clubId: string;
  orderRefId: string;
}): Promise<{ walletId: string; address: string }> {
  const account = await ensureClubCircleAccount(params.clubId);
  const client = getCircleDcwClient();

  const resp = await client.createWallets({
    walletSetId: account.walletSetId,
    blockchains: [CIRCLE_CHAIN],
    count: 1,
    accountType: "EOA",
    metadata: [{ name: `order:${params.orderRefId}`, refId: params.orderRefId }],
  });
  const wallet = resp.data?.wallets?.[0];
  if (!wallet) throw new Error("Failed to create order deposit address");
  return { walletId: wallet.id, address: wallet.address };
}
