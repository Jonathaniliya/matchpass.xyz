"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TicketAreaOption = {
  id: string;
  name: string;
  remaining: number;
  maxPerOrder: number;
  admissionType: "general_admission" | "reserved_seating";
  sectionLabel: string | null;
  rowLabel: string | null;
  entranceLabel: string | null;
  accessInstructions: string | null;
};

type TicketTypeOption = {
  id: string;
  ticketAreaId: string;
  name: string;
  description: string | null;
  priceUsdc: string;
  remaining: number;
  maxPerOrder: number;
  area: TicketAreaOption;
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
  const [selectedAreaId, setSelectedAreaId] = useState(ticketTypes[0]?.ticketAreaId ?? "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [guestEmail, setGuestEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areas = useMemo(() => {
    const unique = new Map<string, TicketAreaOption>();
    for (const ticketType of ticketTypes) unique.set(ticketType.area.id, ticketType.area);
    return [...unique.values()];
  }, [ticketTypes]);
  const areaTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ticketType of ticketTypes) {
      counts.set(
        ticketType.ticketAreaId,
        (counts.get(ticketType.ticketAreaId) ?? 0) + 1,
      );
    }
    return counts;
  }, [ticketTypes]);
  const selectedArea = areas.find((area) => area.id === selectedAreaId) ?? null;
  const visibleTypes = ticketTypes.filter((type) => type.ticketAreaId === selectedAreaId);
  const items = visibleTypes
    .map((type) => ({ ticketTypeId: type.id, quantity: quantities[type.id] ?? 0 }))
    .filter((item) => item.quantity > 0);
  const selectedQuantity = items.reduce((total, item) => total + item.quantity, 0);

  const total = items.reduce((amount, item) => {
    const ticketType = ticketTypes.find((type) => type.id === item.ticketTypeId);
    return ticketType ? amount + Number(ticketType.priceUsdc) * item.quantity : amount;
  }, 0);

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());
  const canSubmit = !submitting && items.length > 0 && (!isGuest || emailLooksValid);
  const blockedReason =
    items.length === 0
      ? "Choose at least one ticket"
      : isGuest && !emailLooksValid
        ? "Enter your email above"
        : null;

  function chooseArea(areaId: string) {
    setSelectedAreaId(areaId);
    setQuantities({});
    setError(null);
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId,
          items,
          ...(isGuest ? { guestEmail: guestEmail.trim().toLowerCase() } : {}),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        const messages: Record<string, string> = {
          identity_verification_required:
            "That email belongs to a fan account. Log in to buy with it.",
          single_area_required: "Choose tickets from one seating area at a time.",
          adjacent_seats_unavailable:
            "There are no adjacent seats left for this group. Choose another area or reduce the quantity.",
          ticket_area_unavailable: "This area just sold out. Pick another area.",
          ticket_type_unavailable: "One of those ticket categories is no longer available.",
        };
        setError(messages[json?.error] ?? "We could not reserve those tickets. Please try again.");
        return;
      }
      router.push(`/orders/${json.orderId}`);
    } catch (requestError) {
      console.error("order_create_failed", requestError);
      setError("Network error — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (areas.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-zinc-400">
        Ticket categories for this match are not on sale yet.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300">1. Choose your area</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {areas.map((area) => {
          const selected = area.id === selectedAreaId;
          const soldOut = area.remaining <= 0;
          const onlyTicketType =
            areaTypeCounts.get(area.id) === 1
              ? ticketTypes.find((type) => type.ticketAreaId === area.id)
              : null;
          const displayName =
            area.name === "General admission" && onlyTicketType
              ? onlyTicketType.name
              : area.name;
          return (
            <button
              key={area.id}
              type="button"
              disabled={soldOut}
              onClick={() => chooseArea(area.id)}
              className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                selected
                  ? "border-cyan-400 bg-cyan-500/10"
                  : "border-border bg-surface-elev hover:border-zinc-500"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium text-zinc-100">{displayName}</span>
                <span className="text-xs text-zinc-500">
                  {soldOut ? "Sold out" : `${area.remaining} left`}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-zinc-300">
                  {area.admissionType === "reserved_seating"
                    ? "Reserved seating"
                    : "General admission"}
                </span>
                {area.sectionLabel && (
                  <span className="text-zinc-400">{area.sectionLabel}</span>
                )}
                {area.rowLabel && (
                  <span className="text-zinc-400">· Row {area.rowLabel}</span>
                )}
                {area.entranceLabel && (
                  <span className="text-zinc-400">· {area.entranceLabel}</span>
                )}
              </div>
              {area.accessInstructions && (
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {area.accessInstructions}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {selectedArea && (
        <>
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300">
              2. Choose ticket types
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {selectedArea.admissionType === "reserved_seating"
                ? "We will hold the best adjacent seats available and show them before payment."
                : "This is unassigned general admission."}
            </p>
            <dl className="mt-3 grid gap-2 rounded-xl border border-border bg-zinc-950/30 p-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Admission</dt>
                <dd className="mt-0.5 text-zinc-200">
                  {selectedArea.admissionType === "reserved_seating"
                    ? "Reserved seat"
                    : "Unassigned general admission"}
                </dd>
              </div>
              {selectedArea.sectionLabel && (
                <div>
                  <dt className="text-zinc-500">Section / stand</dt>
                  <dd className="mt-0.5 text-zinc-200">
                    {selectedArea.sectionLabel}
                    {selectedArea.rowLabel
                      ? ` · Row ${selectedArea.rowLabel}`
                      : ""}
                  </dd>
                </div>
              )}
              {selectedArea.entranceLabel && (
                <div>
                  <dt className="text-zinc-500">Entrance</dt>
                  <dd className="mt-0.5 text-zinc-200">
                    {selectedArea.entranceLabel}
                  </dd>
                </div>
              )}
              {selectedArea.accessInstructions && (
                <div className="sm:col-span-2">
                  <dt className="text-zinc-500">Entry instructions</dt>
                  <dd className="mt-0.5 leading-5 text-zinc-200">
                    {selectedArea.accessInstructions}
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-4 space-y-3">
              {visibleTypes.map((ticketType) => {
                const otherQuantity = selectedQuantity - (quantities[ticketType.id] ?? 0);
                const max = Math.max(
                  0,
                  Math.min(
                    ticketType.remaining,
                    ticketType.maxPerOrder,
                    selectedArea.maxPerOrder - otherQuantity,
                    selectedArea.remaining - otherQuantity,
                  ),
                );
                return (
                  <div
                    key={ticketType.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-elev p-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <p className="font-medium">{ticketType.name}</p>
                        <p className="font-mono text-sm text-cyan-200">{ticketType.priceUsdc} USDC</p>
                      </div>
                      {ticketType.description && (
                        <p className="mt-1 max-w-md text-xs leading-5 text-zinc-500">
                          {ticketType.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-zinc-500">
                        {ticketType.remaining > 0 ? `${ticketType.remaining} in this category` : "Sold out"}
                      </p>
                    </div>
                    <QuantityStepper
                      value={quantities[ticketType.id] ?? 0}
                      max={max}
                      onChange={(value) =>
                        setQuantities((current) => ({ ...current, [ticketType.id]: value }))
                      }
                    />
                  </div>
                );
              })}
            </div>
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
                onChange={(event) => setGuestEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-border bg-surface-elev px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
              <p className="mt-2 text-xs text-zinc-500">
                Buying as guest? <Link href="/login" className="text-gradient-accent">Log in</Link> for faster checkout.
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
            onClick={() => void submit()}
            className="mt-4 w-full rounded-xl gradient-accent py-3 font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Holding seats…" : "Hold tickets & continue"}
          </button>
          {!canSubmit && blockedReason && !submitting && (
            <p className="mt-2 text-center text-xs text-zinc-500">{blockedReason}</p>
          )}
        </>
      )}
    </section>
  );
}

function QuantityStepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        className="h-9 w-9 rounded-full border border-border bg-surface text-lg disabled:opacity-30"
      >
        −
      </button>
      <span className="min-w-[2ch] text-center font-mono">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max || max === 0}
        className="h-9 w-9 rounded-full border border-border bg-surface text-lg disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
