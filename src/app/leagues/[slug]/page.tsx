import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/db/prisma";
import { ClubCard } from "@/components/ui/ClubCard";
import { ClubBadge } from "@/components/ui/ClubBadge";
import { EventCard } from "@/components/ui/EventCard";

export const dynamic = "force-dynamic";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      clubs: {
        orderBy: { name: "asc" },
      },
    },
  });
  if (!league) notFound();

  const clubIds = league.clubs.map((c) => c.id);
  const events = clubIds.length
    ? await prisma.event.findMany({
        where: { clubId: { in: clubIds }, status: "on_sale" },
        orderBy: { startsAt: "asc" },
        include: { club: true },
        take: 12,
      })
    : [];

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <section className="w-full max-w-3xl">
        <div className="flex items-center gap-4">
          <ClubBadge
            name={league.name}
            logoUrl={league.logoUrl}
            logoEmoji={league.logoEmoji ?? "🏆"}
            size="xl"
          />
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {league.country ?? "Football"}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {league.name}
            </h1>
          </div>
        </div>

        <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-zinc-400">
          Clubs
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {league.clubs.map((c) => (
            <ClubCard
              key={c.id}
              slug={c.slug}
              name={c.name}
              logoEmoji={c.logoEmoji}
              logoUrl={c.logoUrl}
              leagueName={league.name}
            />
          ))}
        </div>
        {league.clubs.length === 0 && (
          <p className="mt-3 text-sm text-zinc-500">
            No clubs added to this league yet.
          </p>
        )}

        <h2 className="mt-12 text-sm font-medium uppercase tracking-wide text-zinc-400">
          Upcoming matches
        </h2>
        <div className="mt-3 space-y-3">
          {events.map((e) => (
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
        {events.length === 0 && (
          <p className="mt-3 text-sm text-zinc-500">
            No upcoming matches on sale right now.
          </p>
        )}
      </section>
    </main>
  );
}
