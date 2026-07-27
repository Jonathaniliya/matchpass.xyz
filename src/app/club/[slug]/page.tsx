import Link from "next/link";
import { canManageClub, requireClubPageAccess } from "@/lib/server/auth/clubAccess";
import { prisma } from "@/lib/server/db/prisma";
import { ClubDashboardClient, type DashboardEvent } from "./ClubDashboardClient";

export const dynamic = "force-dynamic";

export default async function ClubDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await requireClubPageAccess(slug);

  const [events, soldTickets, completedOrders] = await Promise.all([
    prisma.event.findMany({
      where: { clubId: access.clubId },
      include: {
        ticketTypes: { orderBy: [{ isActive: "desc" }, { priceUsdc: "asc" }] },
      },
      orderBy: { startsAt: "desc" },
    }),
    prisma.ticket.count({ where: { event: { clubId: access.clubId } } }),
    prisma.order.aggregate({
      where: {
        event: { clubId: access.clubId },
        status: { in: ["paid", "fulfilled"] },
      },
      _count: true,
      _sum: { totalUsdc: true },
    }),
  ]);

  const serializedEvents: DashboardEvent[] = events.map((event) => ({
    id: event.id,
    name: event.name,
    venue: event.venue,
    startsAt: event.startsAt.toISOString(),
    status: event.status,
    ticketTypes: event.ticketTypes.map((ticketType) => ({
      id: ticketType.id,
      name: ticketType.name,
      description: ticketType.description,
      priceUsdc: ticketType.priceUsdc.toString(),
      quantityTotal: ticketType.quantityTotal,
      quantityReserved: ticketType.quantityReserved,
      quantitySold: ticketType.quantitySold,
      maxPerOrder: ticketType.maxPerOrder,
      isActive: ticketType.isActive,
      salesStartAt: ticketType.salesStartAt?.toISOString() ?? null,
      salesEndAt: ticketType.salesEndAt?.toISOString() ?? null,
    })),
  }));

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-6xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Link href="/club" className="text-xs text-zinc-500 hover:text-zinc-300">
              Club workspace
            </Link>
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-cyan-400">
              {access.club.league?.name ?? "Club operations"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              {access.club.name}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-400">
            <span className="rounded-full border border-border px-3 py-1.5">
              {access.role.replace("_", " ")}
            </span>
            <span
              className={`rounded-full px-3 py-1.5 ${
                access.club.circleAccount
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {access.club.circleAccount ? "Wallet ready" : "Wallet pending"}
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Metric label="Events" value={String(events.length)} />
          <Metric label="Tickets issued" value={String(soldTickets)} />
          <Metric
            label="Confirmed sales"
            value={`${completedOrders._sum.totalUsdc?.toString() ?? "0"} USDC`}
            note={`${completedOrders._count} paid orders`}
          />
        </div>

        <div className="mt-10">
          <ClubDashboardClient
            clubSlug={access.club.slug}
            canManage={canManageClub(access.role)}
            events={serializedEvents}
          />
        </div>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-2xl text-zinc-100">{value}</p>
      {note && <p className="mt-1 text-xs text-zinc-500">{note}</p>}
    </div>
  );
}
