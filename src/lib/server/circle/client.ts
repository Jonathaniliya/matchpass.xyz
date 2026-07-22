import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

type CircleDcwClient = ReturnType<typeof initiateDeveloperControlledWalletsClient>;

const g = globalThis as unknown as { __circleDcw?: CircleDcwClient };

export function getCircleDcwClient(): CircleDcwClient {
  if (g.__circleDcw) return g.__circleDcw;
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const baseUrl = process.env.CIRCLE_BASE_URL || "https://api.circle.com";
  if (!apiKey) throw new Error("CIRCLE_API_KEY is not set");
  if (!entitySecret) throw new Error("CIRCLE_ENTITY_SECRET is not set");
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret, baseUrl });
  g.__circleDcw = client;
  return client;
}

export const CIRCLE_CHAIN = (process.env.CIRCLE_WALLET_CHAIN || "ARC-TESTNET") as "ARC-TESTNET";
