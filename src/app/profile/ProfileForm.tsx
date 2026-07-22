"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type ClubOption = {
  id: string;
  name: string;
  logoEmoji: string | null;
  league: { name: string; slug: string } | null;
};

export function ProfileForm({
  initial,
  clubs,
}: {
  initial: {
    displayName: string | null;
    favoriteClubId: string | null;
    preferredCurrency: string;
  };
  clubs: ClubOption[];
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [favoriteClubId, setFavoriteClubId] = useState(
    initial.favoriteClubId ?? "",
  );
  const [preferredCurrency, setPreferredCurrency] = useState(
    initial.preferredCurrency ?? "USDC",
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const grouped = (() => {
    const byLeague = new Map<string, { name: string; clubs: ClubOption[] }>();
    const orphans: ClubOption[] = [];
    for (const c of clubs) {
      if (!c.league) {
        orphans.push(c);
        continue;
      }
      const bucket = byLeague.get(c.league.slug) ?? {
        name: c.league.name,
        clubs: [],
      };
      bucket.clubs.push(c);
      byLeague.set(c.league.slug, bucket);
    }
    return { byLeague: Array.from(byLeague.values()), orphans };
  })();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          favoriteClubId: favoriteClubId === "" ? null : favoriteClubId,
          preferredCurrency,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Update failed");
        setStatus("error");
        return;
      }
      setStatus("saved");
      router.refresh();
    } catch {
      setError("Network error");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
          Display name
        </span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={60}
          className="w-full rounded-xl border border-border bg-surface-elev px-4 py-3 text-foreground outline-none focus:border-cyan-500"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
          Favorite team
        </span>
        <select
          value={favoriteClubId}
          onChange={(e) => setFavoriteClubId(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface-elev px-4 py-3 text-foreground outline-none focus:border-cyan-500"
        >
          <option value="">— None —</option>
          {grouped.byLeague.map((g) => (
            <optgroup key={g.name} label={g.name}>
              {g.clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.logoEmoji ? `${c.logoEmoji}  ` : ""}
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
          {grouped.orphans.length > 0 && (
            <optgroup label="Other">
              {grouped.orphans.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
          Preferred currency
        </span>
        <select
          value={preferredCurrency}
          onChange={(e) => setPreferredCurrency(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface-elev px-4 py-3 text-foreground outline-none focus:border-cyan-500"
        >
          <option value="USDC">USDC — USD Coin (default)</option>
          <option value="EURC">EURC — Euro Coin</option>
        </select>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-xl gradient-accent px-5 py-3 text-sm font-medium text-zinc-950 disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status === "saved" && (
          <span className="text-sm text-zinc-400">Saved.</span>
        )}
        {status === "error" && error && (
          <span className="text-sm text-red-400">{error}</span>
        )}
      </div>
    </form>
  );
}
