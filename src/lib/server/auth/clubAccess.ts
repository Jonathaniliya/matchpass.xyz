import { notFound, redirect } from "next/navigation";
import type { ClubMemberRole, Prisma } from "@prisma/client";
import { createSupabaseServerClient } from "./supabaseServer";
import { prisma } from "../db/prisma";

const clubAccessInclude = {
  club: {
    include: {
      league: true,
      circleAccount: true,
    },
  },
} satisfies Prisma.ClubMemberInclude;

export type ClubAccess = Prisma.ClubMemberGetPayload<{
  include: typeof clubAccessInclude;
}>;

const MANAGEMENT_ROLES = new Set<ClubMemberRole>([
  "owner",
  "admin",
  "box_office",
]);

export function canManageClub(role: ClubMemberRole): boolean {
  return MANAGEMENT_ROLES.has(role);
}

export async function getCurrentClubAccesses(): Promise<ClubAccess[]> {
  const user = await getVerifiedSupabaseUser();
  if (!user) return [];

  await claimPendingClubInvitations(user.id, user.email);

  return prisma.clubMember.findMany({
    where: { supabaseUserId: user.id },
    include: clubAccessInclude,
    orderBy: { club: { name: "asc" } },
  });
}

export async function requireClubPageAccess(
  clubSlug: string,
  options: { manage?: boolean } = {},
): Promise<ClubAccess> {
  const user = await getVerifiedSupabaseUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/club/${clubSlug}`)}`);
  }

  await claimPendingClubInvitations(user.id, user.email);

  const access = await prisma.clubMember.findFirst({
    where: {
      supabaseUserId: user.id,
      club: { slug: clubSlug },
    },
    include: clubAccessInclude,
  });

  // Do not reveal whether a guessed club slug exists.
  if (!access || (options.manage && !canManageClub(access.role))) notFound();
  return access;
}

export async function getClubApiAccess(
  clubSlug: string,
): Promise<{ authenticated: boolean; access: ClubAccess | null }> {
  const user = await getVerifiedSupabaseUser();
  if (!user) return { authenticated: false, access: null };

  await claimPendingClubInvitations(user.id, user.email);

  const access = await prisma.clubMember.findFirst({
    where: {
      supabaseUserId: user.id,
      club: { slug: clubSlug },
    },
    include: clubAccessInclude,
  });
  return { authenticated: true, access };
}

async function getVerifiedSupabaseUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email || !user.email_confirmed_at) return null;
  return { id: user.id, email: user.email.toLowerCase() };
}

async function claimPendingClubInvitations(
  supabaseUserId: string,
  email: string,
): Promise<void> {
  try {
    await prisma.clubMember.updateMany({
      where: {
        email,
        supabaseUserId: null,
      },
      data: {
        supabaseUserId,
        joinedAt: new Date(),
      },
    });
  } catch (error) {
    // Another request may have claimed the same invitation concurrently. The
    // subsequent membership lookup remains the source of truth.
    if (!isUniqueConstraintError(error)) throw error;
  }
}

function isUniqueConstraintError(error: unknown): error is { code: "P2002" } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
