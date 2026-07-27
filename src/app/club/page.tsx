import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentClubAccesses } from "@/lib/server/auth/clubAccess";
import { requireFan } from "@/lib/server/auth/requireFan";

export const dynamic = "force-dynamic";

export default async function ClubWorkspacePage() {
  await requireFan();
  const accesses = await getCurrentClubAccesses();

  if (accesses.length === 1) {
    redirect(`/club/${accesses[0].club.slug}`);
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <section className="w-full max-w-4xl">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
          Club workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Matchday operations
        </h1>

        {accesses.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-medium">No club access yet</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
              Your verified email has no club invitation. Ask a platform owner
              to invite this account before opening the dashboard.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {accesses.map((access) => (
              <Link
                key={access.id}
                href={`/club/${access.club.slug}`}
                className="rounded-2xl border border-border bg-surface p-6 transition hover:border-zinc-600 hover:bg-surface-elev"
              >
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {access.club.league?.name ?? "Independent club"}
                </p>
                <h2 className="mt-2 text-xl font-medium">{access.club.name}</h2>
                <p className="mt-4 text-xs uppercase tracking-wide text-cyan-400">
                  {access.role.replace("_", " ")} · Open workspace →
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
