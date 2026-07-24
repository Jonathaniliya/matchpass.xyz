import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/auth/supabaseServer";
import { prisma } from "@/lib/server/db/prisma";
import { signupSchema } from "@/lib/shared/schemas/auth";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { email, password, displayName, favoriteClubId } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data.user) {
    console.warn("supabase_signup_failed", {
      email,
      supabaseError: error?.message,
      supabaseErrorCode: error?.code,
      hasUser: !!data?.user,
      identities: data?.user?.identities?.length ?? null,
    });
    const isDuplicate =
      !error && data?.user && (data.user.identities?.length ?? 0) === 0;
    return NextResponse.json(
      {
        error: isDuplicate
          ? "email_already_registered"
          : (error?.message ?? "signup_failed"),
      },
      { status: 400 },
    );
  }

  // With email confirmation enabled, signUp returns a User but no verified
  // session. Do not bind an existing guest identity until Auth has confirmed
  // the email and the user signs in.
  if (!data.session) {
    return NextResponse.json(
      { fanId: null, needsConfirmation: true },
      { status: 201 },
    );
  }

  // Link to any pre-existing Fan with this email (guest checkout buyer claiming their account).
  const existing = await prisma.fan.findUnique({ where: { email } });
  const fan = existing
    ? await prisma.fan.update({
        where: { id: existing.id },
        data: {
          supabaseUserId: data.user.id,
          ...(displayName ? { displayName } : {}),
          ...(favoriteClubId ? { favoriteClubId } : {}),
        },
      })
    : await prisma.fan.create({
        data: {
          supabaseUserId: data.user.id,
          email,
          displayName: displayName ?? null,
          favoriteClubId: favoriteClubId ?? null,
        },
      });

  return NextResponse.json({ fanId: fan.id, needsConfirmation: false }, { status: 201 });
}
