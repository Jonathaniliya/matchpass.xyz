import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "guest_fan";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): Buffer {
  const raw = process.env.GUEST_SESSION_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "GUEST_SESSION_SECRET is missing or too short (need >=32 chars). Set it in .env.local.",
    );
  }
  return Buffer.from(raw, "utf8");
}

function sign(fanId: string): string {
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(fanId)
    .digest("base64url");
  return `${fanId}.${sig}`;
}

function verify(value: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const fanId = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(fanId)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? fanId : null;
}

export async function setGuestFanCookie(fanId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, sign(fanId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getGuestFanId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return verify(raw);
}

export async function clearGuestFanCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

// One-shot link tokens for cross-device access via emailed URLs.
// Format: <fanId>.<expiresAtSeconds>.<sig>
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;

export function signAccessToken(fanId: string): string {
  const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  const body = `${fanId}.${exp}`;
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyAccessToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [fanId, expStr, sig] = parts;
  const body = `${fanId}.${expStr}`;
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  return fanId;
}
