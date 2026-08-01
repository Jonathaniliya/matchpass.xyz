import Link from "next/link";
import { prisma } from "@/lib/server/db/prisma";
import { getCurrentFan } from "@/lib/server/auth/requireFan";
import { LeagueCard } from "@/components/ui/LeagueCard";
import { EventCard } from "@/components/ui/EventCard";
import { getCurrentClubAccesses } from "@/lib/server/auth/clubAccess";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const fan = await getCurrentFan();
  if (fan && (await getCurrentClubAccesses()).length > 0) {
    redirect("/club");
  }

  const [topLeagues, favoriteClub] = await Promise.all([
    prisma.league.findMany({
      orderBy: { tier: "asc" },
      include: { _count: { select: { clubs: true } } },
      take: 5,
    }),
    fan?.favoriteClubId
      ? prisma.club.findUnique({ where: { id: fan.favoriteClubId } })
      : Promise.resolve(null),
  ]);

  const upcomingForYou = favoriteClub
    ? await prisma.event.findMany({
        where: { clubId: favoriteClub.id, status: "on_sale" },
        orderBy: { startsAt: "asc" },
        include: { club: true },
        take: 6,
      })
    : [];

  const generalEvents = await prisma.event.findMany({
    where: {
      status: "on_sale",
      ...(favoriteClub ? { NOT: { clubId: favoriteClub.id } } : {}),
    },
    orderBy: { startsAt: "asc" },
    include: { club: true },
    take: 6,
  });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <section className="w-full max-w-3xl text-center">
        <p className="mb-4 inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs uppercase tracking-wide text-zinc-400">
          Stablecoin matchday tickets
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Pay USDC. <span className="text-gradient-accent">Walk in.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-400">
          Football tickets settled on-chain on Arc. Single-use QR at the gate.
          No reseller markup.
        </p>

        {fan && (
          <div className="mx-auto mt-8 inline-flex items-center gap-3 rounded-full border border-border bg-surface px-4 py-2 text-sm text-zinc-300">
            <span>Welcome back,</span>
            <span className="font-medium text-foreground">
              {fan.displayName ?? fan.email}
            </span>
          </div>
        )}
      </section>

      <section className="mt-14 w-full max-w-3xl">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
            Top leagues
          </h2>
          <Link
            href="/leagues"
            className="text-xs text-gradient-accent hover:opacity-80"
          >
            See all →
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {topLeagues.map((l) => (
            <LeagueCard
              key={l.id}
              slug={l.slug}
              name={l.name}
              country={l.country}
              logoEmoji={l.logoEmoji}
              logoUrl={l.logoUrl}
              clubCount={l._count.clubs}
            />
          ))}
        </div>
        {topLeagues.length === 0 && (
          <p className="mt-3 text-sm text-zinc-500">
            No leagues yet. Run <code className="font-mono">npm run db:seed</code>.
          </p>
        )}
      </section>

      {favoriteClub && upcomingForYou.length > 0 && (
        <section className="mt-14 w-full max-w-3xl">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
            Matches for {favoriteClub.name}
          </h2>
          <div className="mt-3 space-y-3">
            {upcomingForYou.map((e) => (
              <EventCard
                key={e.id}
                id={e.id}
                name={e.name}
                venue={e.venue}
                startsAt={e.startsAt}
                clubName={e.club.name}
                clubLogoEmoji={e.club.logoEmoji}
                clubLogoUrl={e.club.logoUrl}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-14 w-full max-w-3xl">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
          {favoriteClub ? "Other matchdays" : "Next matchdays"}
        </h2>
        <div className="mt-3 space-y-3">
          {generalEvents.map((e) => (
            <EventCard
              key={e.id}
              id={e.id}
              name={e.name}
              venue={e.venue}
              startsAt={e.startsAt}
              clubName={e.club.name}
              clubLogoEmoji={e.club.logoEmoji}
              clubLogoUrl={e.club.logoUrl}
            />
          ))}
        </div>
        {generalEvents.length === 0 && upcomingForYou.length === 0 && (
          <p className="mt-3 text-sm text-zinc-500">
            No matchdays on sale right now.
          </p>
        )}
      </section>
    </main>
  );
}
