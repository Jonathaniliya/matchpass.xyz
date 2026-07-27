import { Resend } from "resend";

let cached: Resend | null = null;

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

export function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? "MatchPass.xyz <onboarding@resend.dev>";
}

export function getAppBaseUrl(): string {
  const raw = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_BASE_URL;
  if (!raw) {
    throw new Error("APP_BASE_URL is not set in .env.local");
  }
  return raw.replace(/\/+$/, "");
}
