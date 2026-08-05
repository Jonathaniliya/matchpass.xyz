"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { createSupabaseBrowserClient } from "@/lib/client/supabaseBrowser";

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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
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
    let uploadedPath: string | null = null;
    try {
      let nextAvatarUrl = avatarUrl.trim() || null;
      if (avatarFile) {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("Your session expired. Log in again.");

        const extension = avatarExtension(avatarFile.type);
        uploadedPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-avatars")
          .upload(uploadedPath, avatarFile, {
            cacheControl: "3600",
            contentType: avatarFile.type,
            upsert: false,
          });
        if (uploadError) throw new Error(uploadError.message);
        nextAvatarUrl = supabase.storage
          .from("profile-avatars")
          .getPublicUrl(uploadedPath).data.publicUrl;
      }

      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          avatarUrl: nextAvatarUrl,
          themePreference,
          preferredCurrency: "USDC",
          ...(isClubStaff
            ? {}
            : { favoriteClubId: favoriteClubId === "" ? null : favoriteClubId }),
        }),
      });
      if (!response.ok) {
        if (uploadedPath) {
          const supabase = createSupabaseBrowserClient();
          await supabase.storage
            .from("profile-avatars")
            .remove([uploadedPath])
            .catch(() => undefined);
        }
        const json = await response.json().catch(() => ({}));
        setError(profileError(json.error));
        setStatus("error");
        return;
      }
      setAvatarUrl(nextAvatarUrl ?? "");
      setAvatarFile(null);
      setAvatarPreview(null);
      setStatus("saved");
      router.refresh();
    } catch (caught) {
      if (uploadedPath) {
        const supabase = createSupabaseBrowserClient();
        await supabase.storage
          .from("profile-avatars")
          .remove([uploadedPath])
          .catch(() => undefined);
      }
      setError(
        caught instanceof Error ? caught.message : "Upload failed. Try again.",
      );
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
          avatarUrl={avatarPreview ?? (avatarUrl.trim() || null)}
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

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Profile image
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-xl border border-border bg-surface-elev px-4 py-2.5 text-sm text-foreground hover:border-cyan-600">
            Choose from device
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  setError("Choose an image smaller than 2 MB.");
                  setStatus("error");
                  event.target.value = "";
                  return;
                }
                if (!avatarMimeTypes.has(file.type)) {
                  setError("Choose a JPEG, PNG, WebP, or GIF image.");
                  setStatus("error");
                  event.target.value = "";
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  setAvatarPreview(
                    typeof reader.result === "string" ? reader.result : null,
                  );
                };
                reader.readAsDataURL(file);
                setAvatarFile(file);
                setError(null);
                setStatus("idle");
              }}
            />
          </label>
          {(avatarUrl || avatarFile) && (
            <button
              type="button"
              onClick={() => {
                setAvatarUrl("");
                setAvatarFile(null);
                setAvatarPreview(null);
                setStatus("idle");
              }}
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-zinc-400"
            >
              Remove image
            </button>
          )}
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          JPEG, PNG, WebP, or GIF. Maximum 2 MB.
        </p>
      </div>

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

const avatarMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function avatarExtension(mimeType: string) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const extension = extensions[mimeType];
  if (!extension) throw new Error("Unsupported image type.");
  return extension;
}
