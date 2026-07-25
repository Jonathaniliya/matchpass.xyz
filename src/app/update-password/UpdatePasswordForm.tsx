"use client";

import Link from "next/link";
import { useState } from "react";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        setError(
          json.error === "recovery_session_required"
            ? "This recovery link has expired. Request a new one."
            : (json.error ?? "Password update failed."),
        );
        return;
      }
      setUpdated(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (updated) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-zinc-200">
          Your password has been updated. For security, you&rsquo;ve been signed
          out everywhere.
        </div>
        <Link
          href="/login"
          className="block w-full rounded-xl gradient-accent py-3 text-center font-medium text-zinc-950"
        >
          Log in with new password
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <PasswordField
        label="New password"
        value={password}
        onChange={setPassword}
        autoFocus
      />
      <PasswordField
        label="Confirm password"
        value={confirmation}
        onChange={setConfirmation}
      />
      <p className="text-xs text-zinc-500">Use 8–128 characters.</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl gradient-accent py-3 font-medium text-zinc-950 disabled:opacity-60"
      >
        {submitting ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        required
        autoFocus={autoFocus}
        className="w-full rounded-xl border border-border bg-surface-elev px-4 py-3 text-foreground outline-none focus:border-cyan-500"
      />
    </label>
  );
}
