import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/server/auth/supabaseMiddleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon.ico
     * - public files
     * - the Circle webhook (must receive raw body, no Supabase touch)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks/circle|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
