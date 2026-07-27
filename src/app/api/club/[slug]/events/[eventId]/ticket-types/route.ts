import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { canManageClub, getClubApiAccess } from "@/lib/server/auth/clubAccess";
import { prisma } from "@/lib/server/db/prisma";
import { createTicketTypeSchema } from "@/lib/shared/schemas/clubDashboard";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  {
    params,
  }: { params: Promise<{ slug: string; eventId: string }> },
) {
  const { slug, eventId } = await params;
  const authorization = await getClubApiAccess(slug);
  if (!authorization.authenticated) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!authorization.access || !canManageClub(authorization.access.role)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, clubId: authorization.access.clubId },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createTicketTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const ticketType = await prisma.ticketType.create({
    data: {
      eventId,
      name: parsed.data.name,
      description: parsed.data.description,
      admissionType: parsed.data.admissionType,
      sectionLabel: parsed.data.sectionLabel,
      rowLabel: parsed.data.rowLabel,
      seatStartNumber: parsed.data.seatStartNumber,
      entranceLabel: parsed.data.entranceLabel,
      accessInstructions: parsed.data.accessInstructions,
      isTransferable: parsed.data.isTransferable,
      priceUsdc: new Prisma.Decimal(parsed.data.priceUsdc),
      quantityTotal: parsed.data.quantityTotal,
      maxPerOrder: parsed.data.maxPerOrder,
      isActive: parsed.data.isActive,
      salesStartAt: parsed.data.salesStartAt
        ? new Date(parsed.data.salesStartAt)
        : null,
      salesEndAt: parsed.data.salesEndAt
        ? new Date(parsed.data.salesEndAt)
        : null,
      ...(parsed.data.admissionType === "reserved_seating"
        ? {
            seats: {
              create: Array.from({ length: parsed.data.quantityTotal }, (_, index) => {
                const seatNumber = String((parsed.data.seatStartNumber ?? 1) + index);
                return {
                  label: `${parsed.data.sectionLabel} · Row ${parsed.data.rowLabel} · Seat ${seatNumber}`,
                  sectionLabel: parsed.data.sectionLabel,
                  rowLabel: parsed.data.rowLabel,
                  seatNumber,
                  sortOrder: index,
                };
              }),
            },
          }
        : {}),
    },
    select: { id: true },
  });

  return NextResponse.json(ticketType, { status: 201 });
}
