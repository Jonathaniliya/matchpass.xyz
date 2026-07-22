"use client";

import { useState } from "react";
import { ClubBadge } from "./ClubBadge";

export type FeaturedClub = {
  id: string;
  name: string;
  logoEmoji: string | null;
  logoUrl: string | null;
  league: { name: string; slug: string; country: string | null } | null;
};

export function FavoriteTeamsModal({
  clubs,
  onDone,
}: {
  clubs: FeaturedClub[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group clubs by league preserving league tier order
  const leagueMap = new Map<
    string,
    { name: string; country: string | null; clubs: FeaturedClub[] }
  >();
  for (const c of clubs) {
    if (!c.league) continue;
    const key = c.league.slug;
    const bucket = leagueMap.get(key) ?? {
      name: c.league.name,
      country: c.league.country,
      clubs: [],
    };
    bucket.clubs.push(c);
    leagueMap.set(key, bucket);
  }
  const leagues = Array.from(leagueMap.values());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onContinue() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/favorite-clubs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clubIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Failed to save favourites");
        setSaving(false);
        return;
      }
      onDone();
    } catch {
      setError("Network error");
      setSaving(false);
    }
  }

  const count = selected.size;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background/95 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        {/* Header */}
        <div className="mb-10 text-center">
          <p className="mb-1 text-xs uppercase tracking-widest text-zinc-500">
            Welcome to
          </p>
          <h1 className="text-4xl font-bold tracking-tight">
            ticket<span className="text-gradient-accent">.com</span>
          </h1>
          <p className="mt-4 text-sm text-zinc-400">
            Pick the clubs you follow. We&rsquo;ll personalise your matchday
            feed.
          </p>
        </div>

        {/* Leagues + clubs */}
        <div className="space-y-8">
          {leagues.map((lg) => (
            <div key={lg.name}>
              <div className="mb-3 flex items-baseline gap-2">
                <h2 className="font-semibold text-foreground">{lg.name}</h2>
                {lg.country && (
                  <span className="text-xs text-zinc-500">{lg.country}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {lg.clubs.map((c) => {
                  const active = selected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={`relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all duration-150 ${
                        active
                          ? "border-cyan-500 bg-surface-elev shadow-[0_0_0_2px_rgba(6,182,212,0.20)]"
                          : "border-border bg-surface hover:border-zinc-600 hover:bg-surface-elev"
                      }`}
                    >
                      {active && (
                        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-bold text-zinc-950">
                          ✓
                        </span>
                      )}
                      <ClubBadge
                        name={c.name}
                        logoUrl={c.logoUrl}
                        logoEmoji={c.logoEmoji}
                        size="md"
                        className="!bg-transparent"
                      />
                      <span className="text-xs font-medium leading-tight text-foreground">
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {/* Actions */}
        <div className="mt-10 flex gap-3">
          <button
            type="button"
            onClick={onDone}
            className="rounded-xl border border-border px-5 py-3 text-sm text-zinc-400 transition hover:bg-surface-elev"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={saving}
            className="flex-1 rounded-xl gradient-accent py-3 font-semibold text-zinc-950 transition disabled:opacity-60"
          >
            {saving
              ? "Saving…"
              : count === 0
                ? "Continue without picks →"
                : `Continue with ${count} club${count === 1 ? "" : "s"} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
