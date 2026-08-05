import { requireFan } from "@/lib/server/auth/requireFan";
import { prisma } from "@/lib/server/db/prisma";
import { ProfileForm, type ClubOption } from "./ProfileForm";
import { getCurrentClubAccesses } from "@/lib/server/auth/clubAccess";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const fan = await requireFan();
  const clubAccesses = await getCurrentClubAccesses();
  const isClubStaff = clubAccesses.length > 0;

  const [fullFan, clubs] = await Promise.all([
    prisma.fan.findUnique({ where: { id: fan.id } }),
    isClubStaff
      ? Promise.resolve([])
      : prisma.club.findMany({
          orderBy: [{ league: { tier: "asc" } }, { name: "asc" }],
          include: {
            league: { select: { name: true, slug: true, tier: true } },
          },
        }),
  ]);

  const clubOptions: ClubOption[] = clubs.map((club) => ({
    id: club.id,
    name: club.name,
    logoEmoji: club.logoEmoji,
    league: club.league
      ? { name: club.league.name, slug: club.league.slug }
      : null,
  }));

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <section className="w-full max-w-2xl">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          {isClubStaff ? "Club account" : "Account"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Profile settings
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Choose how MatchPass addresses you and appears on your devices.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Email</p>
          <p className="mt-1 font-mono text-sm text-zinc-200">{fan.email}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-surface p-6">
          <ProfileForm
            initial={{
              displayName: fullFan?.displayName ?? null,
              avatarUrl: fullFan?.avatarUrl ?? null,
              themePreference: fullFan?.themePreference ?? "system",
              favoriteClubId: fullFan?.favoriteClubId ?? null,
            }}
            clubs={clubOptions}
            isClubStaff={isClubStaff}
            email={fan.email}
          />
        </div>
      </section>
    </main>
  );
}
