import { prisma } from "@/lib/server/db/prisma";
import { LeagueCard } from "@/components/ui/LeagueCard";
import { getCurrentClubAccesses } from "@/lib/server/auth/clubAccess";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LeaguesPage() {
  if ((await getCurrentClubAccesses()).length > 0) redirect("/club");
  const leagues = await prisma.league.findMany({
    orderBy: { tier: "asc" },
    include: { _count: { select: { clubs: true } } },
  });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <section className="w-full max-w-3xl">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Football
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Leagues
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Browse top European competitions. Pick a league to see clubs and
          upcoming matchdays.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {leagues.map((l) => (
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

        {leagues.length === 0 && (
          <p className="mt-8 text-sm text-zinc-500">
            No leagues yet. Run <code className="font-mono">npm run db:seed</code>.
          </p>
        )}
      </section>
    </main>
  );
}
