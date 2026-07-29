import { prisma } from "@/lib/server/db/prisma";
import { CIRCLE_CHAIN } from "./client";
import { getCircleUcwClient } from "./ucwClient";

/**
 * Idempotently registers the fan as a Circle user.
 * Circle's createUser is itself idempotent on userId; we still swallow
 * "already exists" errors for safety.
 */
export async function ensureCircleUser(fanId: string): Promise<void> {
  const client = getCircleUcwClient();
  try {
    await client.createUser({ userId: fanId });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (message.includes("already exists") || message.includes("duplicate")) {
      return;
    }
    throw err;
  }
}

/**
 * Returns the credentials needed for the Web SDK to run the PIN+wallet
 * challenge on the client. userToken expires in 60 minutes.
 */
export async function createWalletProvisioningChallenge(fanId: string): Promise<{
  wallet?: {
    walletId: string;
    address: string;
    chain: string;
  };
  userToken?: string;
  encryptionKey?: string;
  challengeId?: string;
}> {
  await ensureCircleUser(fanId);

  // Recover the common partial-success case: Circle created the wallet but
  // the callback could not persist it locally (for example, during a brief DB
  // outage). This keeps retries idempotent and avoids a second PIN setup.
  const existingWallet = await syncFanWalletFromCircle(fanId);
  if (existingWallet) {
    return { wallet: existingWallet };
  }

  const client = getCircleUcwClient();
  const userResp = await client.getUser({ userId: fanId });
  const pinStatus = userResp.data?.user?.pinStatus;

  const tokenResp = await client.createUserToken({ userId: fanId });
  const userToken = tokenResp.data?.userToken;
  const encryptionKey = tokenResp.data?.encryptionKey;
  if (!userToken || !encryptionKey) {
    throw new Error("Failed to create Circle user token");
  }

  // If PIN setup succeeded previously but wallet creation did not, ask Circle
  // for a wallet-only challenge. Otherwise initialize PIN and wallet together.
  const challengeResp =
    pinStatus === "ENABLED"
      ? await client.createWallet({
          userToken,
          blockchains: [CIRCLE_CHAIN],
          accountType: "EOA",
        })
      : await client.createUserPinWithWallets({
          userToken,
          blockchains: [CIRCLE_CHAIN],
          accountType: "EOA",
        });
  const challengeId = challengeResp.data?.challengeId;
  if (!challengeId) {
    throw new Error("Failed to create wallet provisioning challenge");
  }

  return { userToken, encryptionKey, challengeId };
}

/**
 * After the client SDK reports the challenge succeeded, pull the new wallet
 * from Circle and upsert FanCircleWallet. Idempotent.
 */
export async function syncFanWalletFromCircle(fanId: string): Promise<{
  walletId: string;
  address: string;
  chain: string;
} | null> {
  const client = getCircleUcwClient();
  const resp = await client.listWallets({ userId: fanId });
  const wallets = resp.data?.wallets ?? [];
  const wallet = wallets.find((w) => w.blockchain === CIRCLE_CHAIN) ?? wallets[0];
  if (!wallet) return null;

  await prisma.fanCircleWallet.upsert({
    where: { fanId },
    update: {
      walletId: wallet.id,
      address: wallet.address,
      chain: wallet.blockchain,
      userId: fanId,
    },
    create: {
      fanId,
      userId: fanId,
      walletId: wallet.id,
      address: wallet.address,
      chain: wallet.blockchain,
    },
  });

  return { walletId: wallet.id, address: wallet.address, chain: wallet.blockchain };
}
