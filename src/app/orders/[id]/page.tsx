"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QrCodeImg } from "@/components/ui/QrCodeImg";
import { FanWalletPayment } from "@/components/wallet/FanWalletPayment";

type OrderStatusResponse = {
  orderId: string;
  status: "pending" | "paid" | "fulfilled" | "expired" | "review";
  depositAddress: string;
  totalUsdc: string;
  expiresAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPriceUsdc: string;
    admissionType: "general_admission" | "reserved_seating" | null;
    sectionLabel: string | null;
    rowLabel: string | null;
    entranceLabel: string | null;
    seats: string[];
  }>;
};

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderStatusResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    params.then((p) => setOrderId(p.id));
  }, [params]);

  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    let redirected = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as OrderStatusResponse;
        if (!alive) return;
        setOrder(json);
        if (json.status === "fulfilled" && !redirected) {
          redirected = true;
          setTimeout(() => {
            if (alive) router.push(`/orders/${json.orderId}/tickets`);
          }, 2500);
        }
      } catch {
        // swallow
      }
    };
    tick();
    const handle = setInterval(tick, 4000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(handle);
      clearInterval(clock);
    };
  }, [orderId, router]);

  if (!order) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-zinc-400">
        Loading order…
      </main>
    );
  }

  const expiresAt = new Date(order.expiresAt);
  const msLeft = expiresAt.getTime() - now;
  const isExpired = msLeft <= 0 || order.status === "expired";
  const countdown = isExpired
    ? "00:00"
    : `${String(Math.floor(msLeft / 60000)).padStart(2, "0")}:${String(Math.floor((msLeft % 60000) / 1000)).padStart(2, "0")}`;
  const arcPayUri = `ethereum:${order.depositAddress}?value=${order.totalUsdc}`;
  const isPaidOrFulfilled = order.status === "paid" || order.status === "fulfilled";

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-md">
        <StatusBadge status={order.status} />
        {isPaidOrFulfilled ? (
          <>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Payment confirmed
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {order.status === "fulfilled"
                ? "Your tickets are ready. Redirecting…"
                : "Issuing your tickets…"}
            </p>

            <section className="mt-6 flex flex-col items-center gap-4 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/20 text-3xl text-emerald-200">
                ✓
              </div>
              <div>
                <p className="text-sm text-emerald-200">
                  {order.totalUsdc} USDC received
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {order.status === "fulfilled"
                    ? "Tickets issued to your account."
                    : "Webhook confirmed — finalizing tickets."}
                </p>
              </div>
              {order.status === "fulfilled" && (
                <button
                  onClick={() => router.push(`/orders/${order.orderId}/tickets`)}
                  className="mt-2 rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/30"
                >
                  View tickets →
                </button>
              )}
            </section>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Send {order.totalUsdc} USDC on Arc
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Tickets release the moment the transfer confirms.{" "}
              {isExpired ? (
                <span className="text-red-300">Order expired.</span>
              ) : (
                <>
                  Expires in{" "}
                  <span className="font-mono tabular-nums text-zinc-200">
                    {countdown}
                  </span>
                  .
                </>
              )}
            </p>

            <FanWalletPayment
              orderId={order.orderId}
              amountUsdc={order.totalUsdc}
              disabled={isExpired}
            />

            <div className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-zinc-600">
              <span className="h-px flex-1 bg-border" />
              Or pay from another wallet
              <span className="h-px flex-1 bg-border" />
            </div>

            <section className="mt-4 flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface p-6">
              <QrCodeImg value={arcPayUri} size={224} />
              <div className="w-full">
                <p className="text-xs uppercase tracking-wide text-zinc-400">Deposit address</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="block flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-border bg-surface-elev px-3 py-2 font-mono text-xs">
                    {order.depositAddress}
                  </code>
                  <button
                    className="rounded-lg border border-border bg-surface-elev px-3 py-2 text-xs"
                    onClick={async () => {
                      await navigator.clipboard.writeText(order.depositAddress);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Network: Arc Testnet · Token: USDC · Amount: {order.totalUsdc}
                </p>
              </div>
            </section>
          </>
        )}

        <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300">
            Your held tickets
          </p>
          <div className="mt-4 space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{item.name} × {item.quantity}</p>
                  <p className="font-mono text-sm text-zinc-300">
                    {(Number(item.unitPriceUsdc) * item.quantity).toFixed(2)} USDC
                  </p>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {item.admissionType === "reserved_seating"
                    ? `${item.sectionLabel} · Row ${item.rowLabel}`
                    : item.sectionLabel ?? "General admission"}
                  {item.entranceLabel ? ` · ${item.entranceLabel}` : ""}
                </p>
                {item.seats.length > 0 && (
                  <p className="mt-2 rounded-lg border border-cyan-900/60 bg-cyan-950/25 px-3 py-2 text-xs leading-5 text-cyan-100">
                    Assigned: {item.seats.join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
          {order.status === "pending" && !isExpired && (
            <p className="mt-4 text-xs leading-5 text-zinc-500">
              These tickets are held until the countdown expires. Send the exact USDC amount above to confirm them.
            </p>
          )}
        </section>

        {order.status === "review" && (
          <p className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
            Payment received but flagged for review (amount mismatch or expired). Staff will
            reach out.
          </p>
        )}
        {isExpired && order.status === "pending" && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            This order expired. Inventory has been released — start a new order.
          </p>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "fulfilled"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
      : status === "paid"
        ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-200"
        : status === "expired"
          ? "border-red-500/40 bg-red-500/15 text-red-200"
          : status === "review"
            ? "border-yellow-500/40 bg-yellow-500/15 text-yellow-200"
            : "border-border bg-surface text-zinc-300";
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${tone}`}
    >
      {status}
    </span>
  );
}
