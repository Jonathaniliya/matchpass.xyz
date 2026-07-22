"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          displayName: displayName || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Signup failed");
        return;
      }
      if (json.needsConfirmation) {
        setNeedsConfirmation(true);
        return;
      }
      router.refresh();
      router.push("/onboarding");
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-surface-elev p-4 text-sm text-zinc-300">
        Check your inbox to confirm your email. Then{" "}
        <Link href="/login" className="text-gradient-accent font-medium">
          log in
        </Link>
        .
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        required
      />
      <Field
        label="Display name (optional)"
        type="text"
        autoComplete="nickname"
        value={displayName}
        onChange={setDisplayName}
      />
      <Field
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        required
        minLength={8}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl gradient-accent py-3 font-medium text-zinc-950 disabled:opacity-60"
      >
        {submitting ? "Creating account…" : "Sign up"}
      </button>
    </form>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className="w-full rounded-xl border border-border bg-surface-elev px-4 py-3 text-foreground outline-none focus:border-cyan-500"
      />
    </label>
  );
}
