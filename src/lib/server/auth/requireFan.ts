import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabaseServer";
import { getGuestFanId } from "./guestSession";
import { prisma } from "../db/prisma";
import type { Fan } from "@prisma/client";

export async function getCurrentFan(): Promise<Fan | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const fan = await prisma.fan.findUnique({
    where: { supabaseUserId: user.id },
  });
  if (fan) return fan;

  // No Fan yet for this Supabase user. If a guest Fan exists with this email, claim it.
  const email = user.email!.toLowerCase();
  const existing = await prisma.fan.findUnique({ where: { email } });
  if (existing) {
    return prisma.fan.update({
      where: { id: existing.id },
      data: { supabaseUserId: user.id },
    });
  }

  return prisma.fan.create({
    data: { supabaseUserId: user.id, email },
  });
}

export async function requireFan(): Promise<Fan> {
  const fan = await getCurrentFan();
  if (!fan) redirect("/login");
  return fan;
}

// Resolves to the fan that owns the request: signed-in user, or guest via signed cookie.
export async function getCurrentOrGuestFan(): Promise<Fan | null> {
  const fan = await getCurrentFan();
  if (fan) return fan;
  const guestId = await getGuestFanId();
  if (!guestId) return null;
  return prisma.fan.findUnique({ where: { id: guestId } });
}
