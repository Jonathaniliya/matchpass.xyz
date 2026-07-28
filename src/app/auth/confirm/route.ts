import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/auth/supabaseServer";

function safeLocalPath(value: string | null, fallback: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const requestedNext = request.nextUrl.searchParams.get("next");
  const supabase = await createSupabaseServerClient();

  let verified = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    verified = !error;
  }

  const destination = request.nextUrl.clone();
  destination.search = "";
  if (!verified) {
    destination.pathname = "/auth/confirmation-error";
  } else if (type === "recovery" || (!requestedNext && code)) {
    destination.pathname = "/update-password";
  } else {
    destination.pathname = safeLocalPath(requestedNext, "/onboarding");
  }
  return NextResponse.redirect(destination, 303);
}
