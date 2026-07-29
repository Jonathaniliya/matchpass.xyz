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
            ticketArea: { isActive: true },
            AND: [
              { OR: [{ salesStartAt: null }, { salesStartAt: { lte: now } }] },
              { OR: [{ salesEndAt: null }, { salesEndAt: { gt: now } }] },
            ],
          },
          include: { ticketArea: true },
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

        <section className="mt-8">
          <EventBuyForm
            eventId={event.id}
            isGuest={!fan}
            ticketTypes={event.ticketTypes.map((t) => ({
              id: t.id,
              ticketAreaId: t.ticketAreaId,
              name: t.name,
              description: t.description,
              priceUsdc: t.priceUsdc.toString(),
              remaining: t.quantityTotal - t.quantityReserved - t.quantitySold,
              maxPerOrder: t.maxPerOrder,
              area: {
                id: t.ticketArea.id,
                name: t.ticketArea.name,
                remaining:
                  t.ticketArea.quantityTotal -
                  t.ticketArea.quantityReserved -
                  t.ticketArea.quantitySold,
                maxPerOrder: t.ticketArea.maxPerOrder,
                admissionType: t.ticketArea.admissionType,
                sectionLabel: t.ticketArea.sectionLabel,
                rowLabel: t.ticketArea.rowLabel,
                entranceLabel: t.ticketArea.entranceLabel,
                accessInstructions: t.ticketArea.accessInstructions,
              },
            }))}
          />
        </section>
      </article>
    </main>
  );
}
