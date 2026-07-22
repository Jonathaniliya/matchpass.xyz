import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/db/prisma";
import { EventCard } from "@/components/ui/EventCard";
import { ClubBadge } from "@/components/ui/ClubBadge";

export const dynamic = "force-dynamic";

export default async function ClubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const club = await prisma.club.findUnique({
    where: { slug },
    include: { league: true },
  });
  if (!club) notFound();

  const events = await prisma.event.findMany({
    where: { clubId: club.id, status: "on_sale" },
    orderBy: { startsAt: "asc" },
    take: 12,
  });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <section className="w-full max-w-3xl">
        <div className="flex items-center gap-4">
          <ClubBadge
            name={club.name}
            logoUrl={club.logoUrl}
            logoEmoji={club.logoEmoji}
            size="xl"
          />
          <div>
            {club.league && (
              <Link
                href={`/leagues/${club.league.slug}`}
                className="text-xs uppercase tracking-wide text-gradient-accent"
              >
                {club.league.name}
              </Link>
            )}
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {club.name}
            </h1>
          </div>
        </div>

        <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-zinc-400">
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
              clubName={club.name}
              clubLogoEmoji={club.logoEmoji}
              clubLogoUrl={club.logoUrl}
            />
          ))}
        </div>
        {events.length === 0 && (
          <p className="mt-3 text-sm text-zinc-500">
            No upcoming matches on sale.
          </p>
        )}
      </section>
    </main>
  );
}
