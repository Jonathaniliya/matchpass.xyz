import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/auth/supabaseServer";
import { updatePasswordSchema } from "@/lib/shared/schemas/auth";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updatePasswordSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_password" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "recovery_session_required" }, { status: 401 });
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return NextResponse.json(
      { error: error.message || "password_update_failed" },
      { status: 400 },
    );
  }

  // A recovered account should require fresh credentials everywhere.
  await supabase.auth.signOut({ scope: "global" });
  return new NextResponse(null, { status: 204 });
}
