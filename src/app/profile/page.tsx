import Link from "next/link";
import { requireFan } from "@/lib/server/auth/requireFan";
import { prisma } from "@/lib/server/db/prisma";
import { ProfileForm, type ClubOption } from "./ProfileForm";
import { WalletProvisioner } from "@/components/wallet/WalletProvisioner";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const fan = await requireFan();

  const [fullFan, clubs, orders] = await Promise.all([
    prisma.fan.findUnique({
      where: { id: fan.id },
      include: {
        favoriteClub: { include: { league: true } },
        wallet: true,
      },
    }),
    prisma.club.findMany({
      orderBy: [{ league: { tier: "asc" } }, { name: "asc" }],
      include: { league: { select: { name: true, slug: true, tier: true } } },
    }),
    prisma.order.findMany({
      where: { fanId: fan.id },
      orderBy: { createdAt: "desc" },
      include: {
        event: { include: { club: true } },
        items: { include: { tickets: true } },
      },
    }),
  ]);

  const clubOptions: ClubOption[] = clubs.map((c) => ({
    id: c.id,
    name: c.name,
    logoEmoji: c.logoEmoji,
    league: c.league ? { name: c.league.name, slug: c.league.slug } : null,
  }));

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <section className="w-full max-w-2xl">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Account
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Profile
        </h1>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Email</p>
          <p className="mt-1 font-mono text-sm text-zinc-200">{fan.email}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
            Identity
          </h2>
          <div className="mt-4">
            <ProfileForm
              initial={{
                displayName: fullFan?.displayName ?? null,
                favoriteClubId: fullFan?.favoriteClubId ?? null,
                preferredCurrency: fullFan?.preferredCurrency ?? "USDC",
              }}
              clubs={clubOptions}
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
            Wallet
          </h2>
          <div className="mt-3">
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
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
            Order History
          </h2>

          {orders.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No orders yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {orders.map((order) => {
                const ticketCount = order.items.reduce(
                  (sum, item) => sum + item.tickets.length,
                  0,
                );
                const isFulfilled = order.status === "fulfilled";
                const href = isFulfilled
                  ? `/orders/${order.id}/tickets`
                  : `/orders/${order.id}`;

                const statusColors: Record<string, string> = {
                  fulfilled: "bg-emerald-500/15 text-emerald-400",
                  paid: "bg-blue-500/15 text-blue-400",
                  pending: "bg-yellow-500/15 text-yellow-400",
                  expired: "bg-zinc-500/15 text-zinc-400",
                  review: "bg-orange-500/15 text-orange-400",
                };
                const statusClass =
                  statusColors[order.status] ?? "bg-zinc-500/15 text-zinc-400";

                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-tight">
                        {order.event.name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {order.event.club.name} ·{" "}
                        {order.createdAt.toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      <p className="mt-1 font-mono text-xs text-zinc-400">
                        {Number(order.totalUsdc).toFixed(2)} USDC
                        {ticketCount > 0 && (
                          <span className="ml-2 text-zinc-500">
                            · {ticketCount} ticket{ticketCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusClass}`}
                      >
                        {order.status}
                      </span>
                      <Link
                        href={href}
                        className="text-xs text-gradient-accent whitespace-nowrap"
                      >
                        {isFulfilled ? "View Tickets →" : "View Order →"}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
