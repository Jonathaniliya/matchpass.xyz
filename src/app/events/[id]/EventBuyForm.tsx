"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type TicketTypeOption = {
  id: string;
  name: string;
  priceUsdc: string;
  remaining: number;
};

export function EventBuyForm({
  eventId,
  ticketTypes,
  isGuest,
}: {
  eventId: string;
  ticketTypes: TicketTypeOption[];
  isGuest: boolean;
}) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [guestEmail, setGuestEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = ticketTypes
    .map((t) => ({ ticketTypeId: t.id, quantity: quantities[t.id] ?? 0 }))
    .filter((i) => i.quantity > 0);

  const total = useMemo(() => {
    return items.reduce((acc, item) => {
      const tt = ticketTypes.find((t) => t.id === item.ticketTypeId);
      if (!tt) return acc;
      return acc + Number(tt.priceUsdc) * item.quantity;
    }, 0);
  }, [items, ticketTypes]);

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());
  const canSubmit = !submitting && items.length > 0 && (!isGuest || emailLooksValid);

  const blockedReason =
    items.length === 0
      ? "Pick at least one ticket"
      : isGuest && !emailLooksValid
        ? "Enter your email above"
        : null;

  async function submit() {
    if (items.length === 0) {
      setError("Pick at least one ticket first.");
      return;
    }
    if (isGuest && !emailLooksValid) {
      setError("Enter a valid email so we can send your ticket.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId,
          items,
          ...(isGuest ? { guestEmail: guestEmail.trim().toLowerCase() } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("order_create_failed", res.status, json);
        setError(
          typeof json?.error === "string"
            ? `${json.error} (${res.status})`
            : `Request failed (${res.status})`,
        );
        return;
      }
      router.push(`/orders/${json.orderId}`);
    } catch (err) {
      console.error("order_create_threw", err);
      setError("Network error — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
        Pick quantity
      </h3>
      <div className="mt-3 space-y-3">
        {ticketTypes.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{t.name}</p>
              <p className="text-xs text-zinc-500">{t.priceUsdc} USDC each</p>
            </div>
            <QuantityStepper
              value={quantities[t.id] ?? 0}
              max={Math.min(t.remaining, 8)}
              onChange={(v) => setQuantities((q) => ({ ...q, [t.id]: v }))}
            />
          </div>
        ))}
      </div>

      {isGuest && (
        <div className="mt-5 border-t border-border pt-4">
          <label className="text-xs uppercase tracking-wide text-zinc-400">
            Email for your ticket
          </label>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-surface-elev px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Buying as guest. Already have an account?{" "}
            <Link href="/login" className="text-gradient-accent">
              Log in
            </Link>{" "}
            for faster checkout.
          </p>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm text-zinc-400">Total</span>
        <span className="font-mono text-lg">{total.toFixed(2)} USDC</span>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => {
          void submit();
        }}
        className="mt-4 w-full rounded-xl gradient-accent py-3 font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Reserving…" : "Reserve & pay"}
      </button>
      {!canSubmit && blockedReason && !submitting && (
        <p className="mt-2 text-center text-xs text-zinc-500">{blockedReason}</p>
      )}
    </div>
  );
}

function QuantityStepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="h-9 w-9 rounded-full border border-border bg-surface-elev text-lg disabled:opacity-30"
        disabled={value === 0}
      >
        −
      </button>
      <span className="min-w-[2ch] text-center font-mono">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-9 w-9 rounded-full border border-border bg-surface-elev text-lg disabled:opacity-30"
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}
