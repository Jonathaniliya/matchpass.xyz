import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/auth/supabaseServer";
import { prisma } from "@/lib/server/db/prisma";
import { loginSchema } from "@/lib/shared/schemas/auth";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "login_failed" }, { status: 401 });
  }

  // Claim an existing guest fan (email match) or create a new one.
  // A plain upsert on supabaseUserId would miss guest fans that already have
  // this email, causing a duplicate-email Prisma P2002 crash → 500.
  const userId = data.user.id;
  const userEmail = data.user.email!.toLowerCase();

  const existing = await prisma.fan.findUnique({ where: { supabaseUserId: userId } });
  if (!existing) {
    const byEmail = await prisma.fan.findUnique({ where: { email: userEmail } });
    if (byEmail) {
      await prisma.fan.update({
        where: { id: byEmail.id },
        data: { supabaseUserId: userId },
      });
    } else {
      await prisma.fan.create({
        data: { supabaseUserId: userId, email: userEmail },
      });
    }
  }

  const clubMember = await prisma.clubMember.findFirst({
    where: { supabaseUserId: userId },
    select: { id: true },
  });

  return NextResponse.json({
    redirectTo: clubMember ? "/club" : "/",
  });
}
