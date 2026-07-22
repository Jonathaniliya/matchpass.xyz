import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";

type CircleUcwClient = ReturnType<typeof initiateUserControlledWalletsClient>;

const g = globalThis as unknown as { __circleUcw?: CircleUcwClient };

export function getCircleUcwClient(): CircleUcwClient {
  if (g.__circleUcw) return g.__circleUcw;
  const apiKey = process.env.CIRCLE_API_KEY;
  const baseUrl = process.env.CIRCLE_BASE_URL || "https://api.circle.com";
  if (!apiKey) throw new Error("CIRCLE_API_KEY is not set");
  const client = initiateUserControlledWalletsClient({ apiKey, baseUrl });
  g.__circleUcw = client;
  return client;
}
