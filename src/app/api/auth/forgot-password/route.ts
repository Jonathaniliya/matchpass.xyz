import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/auth/supabaseServer";
import { appOrigin } from "@/lib/server/auth/appOrigin";
import { forgotPasswordSchema } from "@/lib/shared/schemas/auth";

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const redirectTo = new URL("/auth/confirm", appOrigin(request)).toString();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  });

  if (error) {
    // Keep the browser response generic to avoid revealing whether an email
    // belongs to an account. Operational details remain server-side.
    console.warn("password_reset_email_failed", {
      code: error.code,
      status: error.status,
      message: error.message,
    });
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
