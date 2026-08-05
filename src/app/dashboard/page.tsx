import Link from "next/link";
import { redirect } from "next/navigation";
import { WalletProvisioner } from "@/components/wallet/WalletProvisioner";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { getCurrentClubAccesses } from "@/lib/server/auth/clubAccess";
import { requireFan } from "@/lib/server/auth/requireFan";
import { syncFanWalletFromCircle } from "@/lib/server/circle/fanWallet";
import { prisma } from "@/lib/server/db/prisma";

export const dynamic = "force-dynamic";

export default async function FanDashboardPage() {
  const fan = await requireFan();
  if ((await getCurrentClubAccesses()).length > 0) redirect("/club");

  const localWallet = await prisma.fanCircleWallet.findUnique({
    where: { fanId: fan.id },
    select: { id: true },
  });
  if (!localWallet) {
    try {
      await syncFanWalletFromCircle(fan.id);
    } catch (error) {
      console.warn("fan_dashboard_wallet_reconciliation_deferred", {
        fanId: fan.id,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  const [fullFan, orders, transfers] = await Promise.all([
    prisma.fan.findUnique({
      where: { id: fan.id },
      include: { wallet: true },
    }),
    prisma.order.findMany({
      where: { fanId: fan.id },
      orderBy: { createdAt: "desc" },
      include: {
        event: { include: { club: true } },
        items: { include: { tickets: true } },
      },
    }),
    prisma.fanWalletTransfer.findMany({
      where: { fanId: fan.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        order: { select: { id: true, event: { select: { name: true } } } },
      },
    }),
  ]);

  const displayName = fullFan?.displayName ?? fan.email.split("@")[0];

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <ProfileAvatar
              avatarUrl={fullFan?.avatarUrl ?? null}
              displayName={fullFan?.displayName ?? null}
              email={fan.email}
              size="lg"
            />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
                Fan dashboard
              </p>
              <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight sm:text-4xl">
                Welcome, {displayName}
              </h1>
            </div>
          </div>
          <Link
            href="/profile"
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-elev"
          >
            Edit profile
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              MatchPass wallet
            </p>
            <h2 className="mt-1 text-xl font-semibold">Balance and transfers</h2>
          </div>
          <WalletProvisioner
            wallet={
              fullFan?.wallet
                ? {
                    address: fullFan.wallet.address,
                    chain: fullFan.wallet.chain,
                  }
                : null
            }
          />
        </div>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Purchases
              </p>
              <h2 className="mt-1 text-2xl font-semibold">Tickets and orders</h2>
            </div>
            <Link href="/" className="text-sm text-cyan-300">
              Find tickets →
            </Link>
          </div>
          {orders.length === 0 ? (
            <EmptyState text="No ticket purchases yet." />
          ) : (
            <div className="mt-4 space-y-3">
              {orders.map((order) => {
                const ticketCount = order.items.reduce(
                  (sum, item) => sum + item.tickets.length,
                  0,
                );
                const fulfilled = order.status === "fulfilled";
                return (
                  <Link
                    key={order.id}
                    href={
                      fulfilled
                        ? `/orders/${order.id}/tickets`
                        : `/orders/${order.id}`
                    }
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:bg-surface-elev"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{order.event.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {order.event.club.name} · {formatDate(order.createdAt)}
                      </p>
                      <p className="mt-1 font-mono text-xs text-zinc-400">
                        {Number(order.totalUsdc).toFixed(2)} USDC · {ticketCount}{" "}
                        ticket{ticketCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <StatusPill status={order.status} />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-10">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Wallet activity
          </p>
          <h2 className="mt-1 text-2xl font-semibold">USDC transactions</h2>
          {transfers.length === 0 ? (
            <EmptyState text="No MatchPass wallet transfers yet." />
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
              {transfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="flex flex-col justify-between gap-3 border-b border-border p-4 last:border-b-0 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {transfer.purpose === "order_payment"
                        ? `Ticket payment${transfer.order?.event.name ? ` · ${transfer.order.event.name}` : ""}`
                        : "USDC sent"}
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-zinc-500">
                      To {shortAddress(transfer.destinationAddress)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatDateTime(transfer.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1">
                    <p className="font-mono text-sm text-zinc-200">
                      −{transfer.amountUsdc.toFixed(2)} USDC
                    </p>
                    <StatusPill status={transfer.challengeStatus} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "fulfilled" || status === "complete"
      ? "bg-emerald-500/15 text-emerald-400"
      : status === "failed" || status === "expired"
        ? "bg-red-500/15 text-red-400"
        : status === "review"
          ? "bg-orange-500/15 text-orange-400"
          : "bg-yellow-500/15 text-yellow-400";
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${tone}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function shortAddress(address: string) {
  return address.length > 18
    ? `${address.slice(0, 10)}…${address.slice(-6)}`
    : address;
}

function formatDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: Date) {
  return value.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
