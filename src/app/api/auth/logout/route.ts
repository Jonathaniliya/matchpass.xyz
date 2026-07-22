import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/auth/supabaseServer";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return new NextResponse(null, { status: 204 });
}
