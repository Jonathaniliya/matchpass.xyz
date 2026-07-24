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
  if (!user.email) return null;
  const email = user.email.toLowerCase();
  const existing = await prisma.fan.findUnique({ where: { email } });
  if (existing) {
    if (existing.supabaseUserId && existing.supabaseUserId !== user.id) {
      console.error("fan_identity_conflict", {
        fanId: existing.id,
        supabaseUserId: user.id,
      });
      return null;
    }

    const claimed = await prisma.fan.updateMany({
      where: { id: existing.id, supabaseUserId: null },
      data: { supabaseUserId: user.id },
    });
    if (claimed.count === 1) {
      return prisma.fan.findUnique({ where: { id: existing.id } });
    }

    return prisma.fan.findUnique({ where: { supabaseUserId: user.id } });
  }

  try {
    return await prisma.fan.create({
      data: { supabaseUserId: user.id, email },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    return prisma.fan.findFirst({
      where: { OR: [{ supabaseUserId: user.id }, { email }] },
    });
  }
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
  return prisma.fan.findFirst({
    where: { id: guestId, supabaseUserId: null },
  });
}

function isUniqueConstraintError(error: unknown): error is { code: "P2002" } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
