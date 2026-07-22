import Link from "next/link";
import { getCurrentFan } from "@/lib/server/auth/requireFan";
import { LogoutButton } from "@/components/ui/LogoutButton";
import { HeaderAccount } from "@/components/ui/HeaderAccount";

export async function SiteHeader() {
  const fan = await getCurrentFan();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          ticket<span className="text-gradient-accent">.com</span>
        </Link>

        <nav className="hidden gap-5 text-sm text-zinc-300 sm:flex">
          <Link href="/leagues" className="hover:text-foreground">
            Leagues
          </Link>
          <Link href="/" className="hover:text-foreground">
            Matchdays
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {fan ? (
            <>
              <HeaderAccount
                fan={{
                  displayName: fan.displayName,
                  email: fan.email,
                  preferredCurrency: (fan as { preferredCurrency?: string }).preferredCurrency ?? "USDC",
                }}
              />
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
