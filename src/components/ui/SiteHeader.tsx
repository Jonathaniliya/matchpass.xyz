import Link from "next/link";
import { LogoutButton } from "@/components/ui/LogoutButton";
import { HeaderAccount } from "@/components/ui/HeaderAccount";
import { prisma } from "@/lib/server/db/prisma";
import { getCurrentClubAccesses } from "@/lib/server/auth/clubAccess";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import type { Fan } from "@prisma/client";

export async function SiteHeader({ fan }: { fan: Fan | null }) {
  let hasClubAccess = false;
  if (fan) {
    try {
      hasClubAccess =
        (await prisma.clubMember.count({
          where: {
            OR: [
              ...(fan.supabaseUserId
                ? [{ supabaseUserId: fan.supabaseUserId }]
                : []),
              { email: fan.email, supabaseUserId: null },
            ],
          },
        })) > 0;
    } catch (error) {
      // Keep the fan-facing app available during the dashboard migration
      // rollout. Any other database error must still fail visibly.
      if (!isMissingTableError(error)) throw error;
      console.warn("club_dashboard_migration_pending");
    }
  }

  if (fan) {
    hasClubAccess = (await getCurrentClubAccesses()).length > 0;
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href={hasClubAccess ? "/club" : "/"} className="text-sm font-semibold tracking-tight">
          matchpass<span className="text-gradient-accent">.xyz</span>
        </Link>

        {!hasClubAccess && (
          <nav className="hidden gap-5 text-sm text-zinc-300 sm:flex">
            <Link href="/leagues" className="hover:text-foreground">
              Leagues
            </Link>
            <Link href="/" className="hover:text-foreground">
              Matchdays
            </Link>
          </nav>
        )}

        <div className="flex items-center gap-2">
          {fan ? (
            <>
              {hasClubAccess ? (
                <>
                  <Link
                    href="/club"
                    className="rounded-full border border-cyan-900/70 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-950/40"
                  >
                    Club workspace
                  </Link>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-xs text-zinc-300 hover:bg-surface-elev"
                  >
                    <ProfileAvatar
                      avatarUrl={fan.avatarUrl}
                      displayName={fan.displayName}
                      email={fan.email}
                      size="sm"
                    />
                    <span className="hidden max-w-28 truncate sm:inline">
                      {fan.displayName ?? "Profile"}
                    </span>
                  </Link>
                </>
              ) : (
                <HeaderAccount
                  fan={{
                    displayName: fan.displayName,
                    avatarUrl: fan.avatarUrl,
                    email: fan.email,
                    preferredCurrency: (fan as { preferredCurrency?: string }).preferredCurrency ?? "USDC",
                  }}
                />
              )}
              <LogoutButton className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-surface-elev disabled:opacity-60" />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-surface-elev"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full gradient-accent px-3 py-1.5 text-xs font-medium text-zinc-950"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function isMissingTableError(error: unknown): error is { code: "P2021" } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2021"
  );
}
