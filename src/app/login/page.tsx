"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Login failed");
        return;
      }
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const safeNext =
        requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
          ? requestedNext
          : "/";
      router.push(safeNext);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Log in to <span className="text-gradient-accent">matchpass.xyz</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Welcome back.</p>

        <SocialAuthButtons intent="login" />

        <form onSubmit={onSubmit} className="mt-2 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-xl border border-border bg-surface-elev px-4 py-3 text-foreground outline-none focus:border-cyan-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Password
              </span>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
              >
                Forgot password?
              </Link>
            </span>
            <span className="relative block">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-border bg-surface-elev px-4 py-3 pr-16 text-foreground outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 px-4 text-xs font-medium text-zinc-400 hover:text-zinc-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl gradient-accent py-3 font-medium text-zinc-950 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          No account?{" "}
          <Link href="/signup" className="text-gradient-accent font-medium">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
