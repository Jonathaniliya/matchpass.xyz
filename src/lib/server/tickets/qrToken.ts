import crypto from "node:crypto";

export type QrPayload = `v1.${string}.${string}`;

function getQrSecret(): Buffer {
  const raw = process.env.QR_TOKEN_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "QR_TOKEN_SECRET is missing or too short (need >=32 chars). Set it in .env.local.",
    );
  }
  return Buffer.from(raw, "utf8");
}

export function deriveQrToken(ticketId: string): { token: string; tokenHash: string } {
  const token = crypto
    .createHmac("sha256", getQrSecret())
    .update(ticketId)
    .digest("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function buildQrPayload(ticketId: string, token: string): QrPayload {
  return `v1.${ticketId}.${token}`;
}

export function parseQrPayload(payload: string):
  | { version: "v1"; ticketId: string; token: string }
  | null {
  const parts = payload.split(".");
  if (parts.length !== 3) return null;
  const [version, ticketId, token] = parts;
  if (version !== "v1" || !ticketId || !token) return null;
  return { version, ticketId, token };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
