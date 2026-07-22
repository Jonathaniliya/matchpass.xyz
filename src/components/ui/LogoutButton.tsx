"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    setSubmitting(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting}
      className={
        className ??
        "rounded-full border border-border px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-surface disabled:opacity-60"
      }
    >
      {submitting ? "Logging out…" : "Log out"}
    </button>
  );
}
