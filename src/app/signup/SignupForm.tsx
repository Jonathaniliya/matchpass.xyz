"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationStatus, setConfirmationStatus] = useState<
    "sent" | "uncertain" | null
  >(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmationStatus(null);
    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }
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
        // Defensive compatibility with an older server response: this is not
        // a definitive failure because Supabase may already have sent mail.
        if (json.error === "signup_status_uncertain") {
          setConfirmationStatus("uncertain");
          return;
        }
        setError(signupErrorMessage(json.error));
        return;
      }
      if (json.needsConfirmation) {
        setConfirmationStatus(
          json.confirmationStatus === "uncertain" ? "uncertain" : "sent",
        );
        return;
      }
      router.refresh();
      router.push("/onboarding");
    } catch {
      // The request may have reached Supabase even if the browser never
      // received our response. Avoid showing a false signup failure.
      setConfirmationStatus("uncertain");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmationStatus) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-surface-elev p-4 text-sm text-zinc-300">
        {confirmationStatus === "sent"
          ? "We sent a confirmation link. Check your inbox to finish signing up."
          : "Check your inbox for a confirmation link. If it does not arrive within a few minutes, return here and try again."}{" "}
        Then{" "}
        <Link href="/login" className="text-gradient-accent font-medium">
          log in
        </Link>
        .
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 space-y-4">
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
      <PasswordField
        label="Password"
        value={password}
        onChange={setPassword}
        visible={showPasswords}
        onToggleVisibility={() => setShowPasswords((visible) => !visible)}
      />
      <PasswordField
        label="Repeat password"
        value={passwordConfirmation}
        onChange={setPasswordConfirmation}
        visible={showPasswords}
        onToggleVisibility={() => setShowPasswords((visible) => !visible)}
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

function signupErrorMessage(code: unknown): string {
  const messages: Record<string, string> = {
    confirmation_email_rate_limited:
      "Too many confirmation emails were requested. Wait about an hour and try again, or use Google sign-in.",
    email_already_registered:
      "An account already uses this email. Log in or reset its password instead.",
    weak_password: "Choose a stronger password with a mix of letters, numbers, and symbols.",
    invalid_email: "Enter a valid email address.",
    email_signup_disabled: "Email and password signup is temporarily unavailable.",
    invalid_body: "Check the email, display name, and password fields.",
    signup_failed: "We could not create the account. Try again shortly.",
  };
  return typeof code === "string"
    ? (messages[code] ?? "Signup failed. Try again.")
    : "Signup failed. Try again.";
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggleVisibility,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <span className="relative block">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          className="w-full rounded-xl border border-border bg-surface-elev px-4 py-3 pr-16 text-foreground outline-none focus:border-cyan-500"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute inset-y-0 right-0 px-4 text-xs font-medium text-zinc-400 hover:text-zinc-200"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </label>
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
