import type { NextRequest } from "next/server";

export function appOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin;
      }
    } catch {
      console.warn("auth_invalid_app_url");
    }
  }
  return request.nextUrl.origin;
}
