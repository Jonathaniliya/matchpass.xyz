"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/client/supabaseBrowser";

type Provider = "google" | "apple";

function safeLocalPath(value: string | null, fallback: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export function SocialAuthButtons({ intent }: { intent: "login" | "signup" }) {
  const [activeProvider, setActiveProvider] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function continueWith(provider: Provider) {
    setError(null);
    setActiveProvider(provider);

    const requestedNext = new URLSearchParams(window.location.search).get("next");
    const next =
      intent === "signup"
        ? "/onboarding"
        : safeLocalPath(requestedNext, "/");
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);

    const supabase = createSupabaseBrowserClient();
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callback.toString(),
        skipBrowserRedirect: true,
        ...(provider === "google"
          ? { queryParams: { prompt: "select_account" } }
          : {}),
      },
    });

    if (oauthError || !data.url) {
      setError(oauthError?.message ?? `${provider} sign-in is unavailable.`);
      setActiveProvider(null);
      return;
    }

    window.location.assign(data.url);
  }

  return (
    <div className="mt-6 space-y-3">
      <SocialButton
        provider="google"
        label="Continue with Google"
        busy={activeProvider === "google"}
        disabled={activeProvider !== null}
        onClick={() => continueWith("google")}
      />
      <SocialButton
        provider="apple"
        label="Continue with Apple"
        busy={activeProvider === "apple"}
        disabled={activeProvider !== null}
        onClick={() => continueWith("apple")}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center gap-3 py-1" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

function SocialButton({
  provider,
  label,
  busy,
  disabled,
  onClick,
}: {
  provider: Provider;
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface-elev px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
    >
      {provider === "google" ? <GoogleMark /> : <AppleMark />}
      {busy ? "Opening…" : label}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.86A6 6 0 0 1 6.07 12c0-.65.11-1.28.32-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.01c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-current"
    >
      <path d="M17.05 12.54c.02-2.14 1.75-3.17 1.83-3.22a4.02 4.02 0 0 0-3.16-1.71c-1.33-.14-2.62.8-3.3.8-.7 0-1.74-.79-2.88-.76a4.2 4.2 0 0 0-3.54 2.16c-1.53 2.64-.39 6.52 1.08 8.65.74 1.05 1.6 2.23 2.74 2.19 1.12-.05 1.54-.7 2.89-.7 1.34 0 1.73.7 2.9.67 1.2-.02 1.96-1.05 2.67-2.11a8.64 8.64 0 0 0 1.22-2.49 3.72 3.72 0 0 1-2.45-3.48ZM14.85 6.2a3.83 3.83 0 0 0 .88-2.74 3.9 3.9 0 0 0-2.53 1.3 3.64 3.64 0 0 0-.9 2.64 3.22 3.22 0 0 0 2.55-1.2Z" />
    </svg>
  );
}
