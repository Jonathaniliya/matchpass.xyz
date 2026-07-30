import { NextResponse, type NextRequest } from "next/server";
import type { AuthError } from "@supabase/supabase-js";
import { appOrigin } from "@/lib/server/auth/appOrigin";
import { createSupabaseServerClient } from "@/lib/server/auth/supabaseServer";
import { prisma } from "@/lib/server/db/prisma";
import { signupSchema } from "@/lib/shared/schemas/auth";

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { email, password, displayName, favoriteClubId } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const emailRedirectTo = new URL("/auth/confirm", appOrigin(req));
  emailRedirectTo.searchParams.set("next", "/onboarding");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: emailRedirectTo.toString() },
  });
  if (error || !data.user) {
    const errorCode = signupErrorCode(error);
    const outcomeUncertain = errorCode === "signup_status_uncertain";
    console.warn(
      `${outcomeUncertain ? "supabase_signup_outcome_uncertain" : "supabase_signup_failed"} ${JSON.stringify({
        hasError: Boolean(error),
        name: error?.name ?? null,
        code: error?.code ?? null,
        status: error?.status ?? null,
        hasUser: Boolean(data?.user),
      })}`,
    );

    // Supabase can accept the signup and queue the confirmation email before
    // the response is interrupted. Do not present that indeterminate outcome
    // as a failed account creation or encourage an immediate duplicate retry.
    if (outcomeUncertain) {
      return NextResponse.json(
        {
          fanId: null,
          needsConfirmation: true,
          confirmationStatus: "uncertain",
        },
        { status: 202 },
      );
    }

    return NextResponse.json(
      { error: errorCode },
      { status: error?.status === 429 ? 429 : 400 },
    );
  }

  // Supabase deliberately returns an obfuscated user with no identities when
  // the email already exists. Treat it as an existing account instead of
  // telling the browser that another confirmation email was sent.
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return NextResponse.json(
      { error: "email_already_registered" },
      { status: 409 },
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

function signupErrorCode(error: AuthError | null): string {
  switch (error?.code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "confirmation_email_rate_limited";
    case "weak_password":
      return "weak_password";
    case "email_address_invalid":
      return "invalid_email";
    case "signup_disabled":
      return "email_signup_disabled";
    case "user_already_exists":
      return "email_already_registered";
    default:
      // Unknown Auth and transport errors can arrive after Supabase accepted
      // the signup and queued the confirmation email.
      return error ? "signup_status_uncertain" : "signup_failed";
  }
}
