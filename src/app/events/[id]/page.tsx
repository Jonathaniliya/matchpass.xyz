import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/db/prisma";
import { getCurrentFan } from "@/lib/server/auth/requireFan";
import { EventBuyForm } from "./EventBuyForm";

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const now = new Date();
  const [event, fan] = await Promise.all([
    prisma.event.findUnique({
      where: { id },
      include: {
        club: true,
        ticketTypes: {
          where: {
            isActive: true,
            AND: [
              { OR: [{ salesStartAt: null }, { salesStartAt: { lte: now } }] },
              { OR: [{ salesEndAt: null }, { salesEndAt: { gt: now } }] },
            ],
          },
          orderBy: { priceUsdc: "asc" },
        },
      },
    }),
    getCurrentFan(),
  ]);
  if (!event || event.status !== "on_sale") notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <article className="w-full max-w-2xl">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{event.club.name}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {event.name}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {event.venue} ·{" "}
          {event.startsAt.toLocaleString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>

        <section className="mt-8 space-y-3">
          {event.ticketTypes.map((tt) => {
            const remaining = tt.quantityTotal - tt.quantityReserved - tt.quantitySold;
            return (
              <div
                key={tt.id}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-medium">{tt.name}</h3>
                  <p className="font-mono text-lg">
                    {tt.priceUsdc.toString()} <span className="text-sm text-zinc-400">USDC</span>
                  </p>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {remaining > 0 ? `${remaining} remaining` : "Sold out"}
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  {tt.admissionType === "reserved_seating"
                    ? `${tt.sectionLabel} · Row ${tt.rowLabel} · seat assigned at checkout`
                    : tt.sectionLabel ?? "General admission"}
                  {tt.entranceLabel ? ` · ${tt.entranceLabel}` : ""}
                </p>
                {tt.description && (
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{tt.description}</p>
                )}
              </div>
            );
          })}
        </section>

        <section className="mt-8">
          <EventBuyForm
            eventId={event.id}
            isGuest={!fan}
            ticketTypes={event.ticketTypes.map((t) => ({
              id: t.id,
              name: t.name,
              priceUsdc: t.priceUsdc.toString(),
              remaining: t.quantityTotal - t.quantityReserved - t.quantitySold,
              maxPerOrder: t.maxPerOrder,
              admissionType: t.admissionType,
              sectionLabel: t.sectionLabel,
              rowLabel: t.rowLabel,
              entranceLabel: t.entranceLabel,
            }))}
          />
        </section>
      </article>
    </main>
  );
}
