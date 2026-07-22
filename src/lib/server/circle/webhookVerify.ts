import crypto from "node:crypto";

type CachedKey = { keyId: string; publicKey: crypto.KeyObject; cachedAt: number };

const cache = new Map<string, CachedKey>();

const CACHE_TTL_MS = Number(process.env.CIRCLE_WEBHOOK_PUBLIC_KEY_CACHE_TTL_MS ?? "600000");

async function fetchPublicKey(keyId: string): Promise<crypto.KeyObject> {
  const baseUrl = process.env.CIRCLE_BASE_URL || "https://api.circle.com";
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) throw new Error("CIRCLE_API_KEY is not set");

  const res = await fetch(`${baseUrl}/v2/notifications/publicKey/${encodeURIComponent(keyId)}`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Circle public key ${keyId}: HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data?: { publicKey?: string; algorithm?: string } };
  const publicKeyBase64 = json.data?.publicKey;
  if (!publicKeyBase64) throw new Error("Circle public key response missing publicKey");

  return crypto.createPublicKey({
    key: Buffer.from(publicKeyBase64, "base64"),
    format: "der",
    type: "spki",
  });
}

async function getPublicKey(keyId: string): Promise<crypto.KeyObject> {
  const cached = cache.get(keyId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.publicKey;
  }
  const publicKey = await fetchPublicKey(keyId);
  cache.set(keyId, { keyId, publicKey, cachedAt: Date.now() });
  return publicKey;
}

export type VerifyResult = { ok: true; keyId: string } | { ok: false; reason: string };

export async function verifyCircleSignature(
  rawBody: string,
  headers: Headers,
): Promise<VerifyResult> {
  const signatureB64 = headers.get("x-circle-signature");
  const keyId = headers.get("x-circle-key-id");
  if (!signatureB64 || !keyId) {
    return { ok: false, reason: "missing_signature_headers" };
  }

  let publicKey: crypto.KeyObject;
  try {
    publicKey = await getPublicKey(keyId);
  } catch (err) {
    return { ok: false, reason: `public_key_fetch_failed:${(err as Error).message}` };
  }

  const signatureBytes = Buffer.from(signatureB64, "base64");
  const messageBytes = Buffer.from(rawBody, "utf-8");
  const valid = crypto.verify("sha256", messageBytes, publicKey, signatureBytes);
  if (!valid) return { ok: false, reason: "signature_mismatch" };
  return { ok: true, keyId };
}
