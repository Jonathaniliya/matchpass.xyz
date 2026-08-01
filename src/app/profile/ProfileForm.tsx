"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";

export type ClubOption = {
  id: string;
  name: string;
  logoEmoji: string | null;
  league: { name: string; slug: string } | null;
};

type ThemePreference = "system" | "light" | "dark";

export function ProfileForm({
  initial,
  clubs,
  isClubStaff,
  email,
}: {
  initial: {
    displayName: string | null;
    avatarUrl: string | null;
    themePreference: string;
    favoriteClubId: string | null;
  };
  clubs: ClubOption[];
  isClubStaff: boolean;
  email: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? "");
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    isThemePreference(initial.themePreference)
      ? initial.themePreference
      : "system",
  );
  const [favoriteClubId, setFavoriteClubId] = useState(
    initial.favoriteClubId ?? "",
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = themePreference;
  }, [themePreference]);

  const grouped = (() => {
    const byLeague = new Map<string, { name: string; clubs: ClubOption[] }>();
    const orphans: ClubOption[] = [];
    for (const club of clubs) {
      if (!club.league) {
        orphans.push(club);
        continue;
      }
      const bucket = byLeague.get(club.league.slug) ?? {
        name: club.league.name,
        clubs: [],
      };
      bucket.clubs.push(club);
      byLeague.set(club.league.slug, bucket);
    }
    return { byLeague: Array.from(byLeague.values()), orphans };
  })();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
          themePreference,
          preferredCurrency: "USDC",
          ...(isClubStaff
            ? {}
            : { favoriteClubId: favoriteClubId === "" ? null : favoriteClubId }),
        }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        setError(profileError(json.error));
        setStatus("error");
        return;
      }
      setStatus("saved");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setStatus("error");
    }
  }

  function chooseTheme(theme: ThemePreference) {
    setThemePreference(theme);
    setStatus("idle");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        <ProfileAvatar
          avatarUrl={avatarUrl.trim() || null}
          displayName={displayName.trim() || null}
          email={email}
          size="lg"
        />
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {displayName.trim() || email}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {isClubStaff ? "Club staff profile" : "Fan profile"}
          </p>
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
          Display name
        </span>
        <input
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={60}
          placeholder="How MatchPass should address you"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
          Avatar or NFT image URL
        </span>
        <input
          type="url"
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
          maxLength={2048}
          placeholder="https://…"
          className={inputClass}
        />
        <span className="mt-2 block text-xs leading-5 text-zinc-500">
          Use a public HTTP(S) image URL. MatchPass does not request access to
          the wallet that owns an NFT.
        </span>
      </label>

      <fieldset>
        <legend className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Appearance
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(["system", "light", "dark"] as const).map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => chooseTheme(theme)}
              className={`rounded-xl border px-4 py-3 text-left text-sm capitalize transition ${
                themePreference === theme
                  ? "border-cyan-500 bg-cyan-500/10 text-foreground"
                  : "border-border bg-surface-elev text-zinc-400"
              }`}
            >
              {theme}
              <span className="mt-1 block text-[11px] normal-case text-zinc-500">
                {theme === "system" ? "Follow this device" : `${theme} mode`}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {!isClubStaff && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
            Favorite team
          </span>
          <select
            value={favoriteClubId}
            onChange={(event) => setFavoriteClubId(event.target.value)}
            className={inputClass}
          >
            <option value="">— None —</option>
            {grouped.byLeague.map((group) => (
              <optgroup key={group.name} label={group.name}>
                {group.clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.logoEmoji ? `${club.logoEmoji}  ` : ""}
                    {club.name}
                  </option>
                ))}
              </optgroup>
            ))}
            {grouped.orphans.length > 0 && (
              <optgroup label="Other">
                {grouped.orphans.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      )}

      <div className="rounded-xl border border-border bg-surface-elev px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Currency</p>
        <p className="mt-1 text-sm font-medium text-foreground">USDC only</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-xl gradient-accent px-5 py-3 text-sm font-medium text-zinc-950 disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save profile"}
        </button>
        {status === "saved" && (
          <span className="text-sm text-emerald-400">Saved.</span>
        )}
        {status === "error" && error && (
          <span className="text-sm text-red-400">{error}</span>
        )}
      </div>
    </form>
  );
}

function isThemePreference(value: string): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function profileError(code: unknown) {
  if (code === "invalid_body") {
    return "Check the display name and use a valid HTTP(S) image URL.";
  }
  return typeof code === "string"
    ? code.replaceAll("_", " ")
    : "Update failed. Try again.";
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface-elev px-4 py-3 text-foreground outline-none focus:border-cyan-500";
