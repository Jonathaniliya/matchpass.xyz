"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QrCodeImg } from "@/components/ui/QrCodeImg";

type TicketsResponse = {
  orderId: string;
  eventName: string;
  clubName: string;
  venue: string;
  startsAt: string;
  holder: {
    email: string;
    walletShort: string | null;
  };
  tickets: Array<{
    ticketId: string;
    ticketTypeName: string;
    seatLabel: string | null;
    qrPayload: string | null;
    qrStatus: "active" | "used" | "expired" | "revoked";
    expiresAt: string;
  }>;
};

export default function TicketsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [data, setData] = useState<TicketsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setOrderId(p.id));
  }, [params]);

  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/tickets`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setError(json.error ?? "Could not load tickets");
          return;
        }
        setData(json as TicketsResponse);
      } catch {
        if (alive) setError("Network error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId]);

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-red-300">{error}</p>
          <Link href="/" className="mt-4 inline-block text-sm text-gradient-accent">
            ← Back home
          </Link>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-zinc-400">
        Loading tickets…
      </main>
    );
  }

  const startsAt = new Date(data.startsAt);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-md">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          {data.clubName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {data.eventName}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {data.venue} ·{" "}
          {startsAt.toLocaleString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          Show each QR at the gate. Single-use — once scanned, the ticket is
          marked as used and can&apos;t be reused.
        </p>

        <div className="mt-6 space-y-4">
          {data.tickets.map((t) => (
            <TicketCard key={t.ticketId} ticket={t} holder={data.holder} />
          ))}
        </div>
      </div>
    </main>
  );
}

function TicketCard({
  ticket,
  holder,
}: {
  ticket: TicketsResponse["tickets"][number];
  holder: TicketsResponse["holder"];
}) {
  return (
    <article className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface p-6">
      <div className="w-full text-left">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          {ticket.ticketTypeName}
        </p>
        {ticket.seatLabel && (
          <p className="mt-1 text-sm text-zinc-300">Seat {ticket.seatLabel}</p>
        )}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-surface-elev px-3 py-2">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
              Holder
            </p>
            <p className="text-sm text-zinc-200">{holder.email}</p>
          </div>
          {holder.walletShort && (
            <p className="font-mono text-xs text-zinc-400">
              {holder.walletShort}
            </p>
          )}
        </div>
      </div>

      {ticket.qrPayload ? (
        <>
          <QrCodeImg value={ticket.qrPayload} size={240} />
          <p className="font-mono text-[10px] text-zinc-500 break-all">
            {ticket.ticketId}
          </p>
        </>
      ) : (
        <div className="flex h-60 w-60 flex-col items-center justify-center rounded-xl border border-border bg-surface-elev text-center text-sm">
          <p className="text-zinc-400 uppercase tracking-wide text-xs">
            {ticket.qrStatus}
          </p>
          <p className="mt-1 text-zinc-500 text-xs px-4">
            {ticket.qrStatus === "used"
              ? "Already scanned at the gate"
              : ticket.qrStatus === "expired"
                ? "This ticket has expired"
                : "Ticket revoked"}
          </p>
        </div>
      )}
    </article>
  );
}
