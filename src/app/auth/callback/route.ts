import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/auth/supabaseServer";
import { getCurrentClubAccesses } from "@/lib/server/auth/clubAccess";

function safeLocalPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeLocalPath(request.nextUrl.searchParams.get("next"));
  const destination = request.nextUrl.clone();
  destination.search = "";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      destination.pathname =
        (await getCurrentClubAccesses()).length > 0 && next !== "/club"
          ? "/club"
          : next;
      return NextResponse.redirect(destination, 303);
    }
  }

  destination.pathname = "/auth/oauth-error";
  return NextResponse.redirect(destination, 303);
}
