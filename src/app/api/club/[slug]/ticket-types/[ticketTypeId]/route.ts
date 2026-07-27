import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { canManageClub, getClubApiAccess } from "@/lib/server/auth/clubAccess";
import { prisma } from "@/lib/server/db/prisma";
import { updateTicketTypeSchema } from "@/lib/shared/schemas/clubDashboard";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  {
    params,
  }: { params: Promise<{ slug: string; ticketTypeId: string }> },
) {
  const { slug, ticketTypeId } = await params;
  const authorization = await getClubApiAccess(slug);
  if (!authorization.authenticated) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!authorization.access || !canManageClub(authorization.access.role)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ticketType = await prisma.ticketType.findFirst({
    where: {
      id: ticketTypeId,
      event: { clubId: authorization.access.clubId },
    },
  });
  if (!ticketType) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateTicketTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const quantityTotal = parsed.data.quantityTotal ?? ticketType.quantityTotal;
  if (quantityTotal < ticketType.quantityReserved + ticketType.quantitySold) {
    return NextResponse.json(
      { error: "quantity_below_committed_inventory" },
      { status: 409 },
    );
  }

  if (
    parsed.data.admissionType !== undefined &&
    parsed.data.admissionType !== ticketType.admissionType
  ) {
    return NextResponse.json(
      { error: "admission_type_locked" },
      { status: 409 },
    );
  }

  const sectionLabel =
    parsed.data.sectionLabel === undefined
      ? ticketType.sectionLabel
      : parsed.data.sectionLabel;
  const rowLabel =
    parsed.data.rowLabel === undefined ? ticketType.rowLabel : parsed.data.rowLabel;
  const seatStartNumber =
    parsed.data.seatStartNumber === undefined
      ? ticketType.seatStartNumber
      : parsed.data.seatStartNumber;
  const reservedStructureChanged =
    ticketType.admissionType === "reserved_seating" &&
    (quantityTotal !== ticketType.quantityTotal ||
      sectionLabel !== ticketType.sectionLabel ||
      rowLabel !== ticketType.rowLabel ||
      seatStartNumber !== ticketType.seatStartNumber);
  if (
    reservedStructureChanged &&
    ticketType.quantityReserved + ticketType.quantitySold > 0
  ) {
    return NextResponse.json(
      { error: "seat_inventory_locked" },
      { status: 409 },
    );
  }
  if (
    ticketType.admissionType === "reserved_seating" &&
    (!sectionLabel || !rowLabel || !seatStartNumber)
  ) {
    return NextResponse.json(
      { error: "reserved_seat_configuration_required" },
      { status: 400 },
    );
  }

  const salesStartAt =
    parsed.data.salesStartAt === undefined
      ? ticketType.salesStartAt
      : parsed.data.salesStartAt
        ? new Date(parsed.data.salesStartAt)
        : null;
  const salesEndAt =
    parsed.data.salesEndAt === undefined
      ? ticketType.salesEndAt
      : parsed.data.salesEndAt
        ? new Date(parsed.data.salesEndAt)
        : null;
  if (salesStartAt && salesEndAt && salesEndAt <= salesStartAt) {
    return NextResponse.json({ error: "invalid_sales_window" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.ticketType.update({
      where: { id: ticketTypeId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description }
          : {}),
        ...(parsed.data.sectionLabel !== undefined ? { sectionLabel } : {}),
        ...(parsed.data.rowLabel !== undefined ? { rowLabel } : {}),
        ...(parsed.data.seatStartNumber !== undefined ? { seatStartNumber } : {}),
        ...(parsed.data.entranceLabel !== undefined
          ? { entranceLabel: parsed.data.entranceLabel }
          : {}),
        ...(parsed.data.accessInstructions !== undefined
          ? { accessInstructions: parsed.data.accessInstructions }
          : {}),
        ...(parsed.data.isTransferable !== undefined
          ? { isTransferable: parsed.data.isTransferable }
          : {}),
        ...(parsed.data.priceUsdc !== undefined
          ? { priceUsdc: new Prisma.Decimal(parsed.data.priceUsdc) }
          : {}),
        ...(parsed.data.quantityTotal !== undefined ? { quantityTotal } : {}),
        ...(parsed.data.maxPerOrder !== undefined
          ? { maxPerOrder: parsed.data.maxPerOrder }
          : {}),
        ...(parsed.data.isActive !== undefined
          ? { isActive: parsed.data.isActive }
          : {}),
        ...(parsed.data.salesStartAt !== undefined ? { salesStartAt } : {}),
        ...(parsed.data.salesEndAt !== undefined ? { salesEndAt } : {}),
      },
      select: { id: true },
    });

    if (reservedStructureChanged) {
      await tx.ticketSeat.deleteMany({ where: { ticketTypeId } });
      await tx.ticketSeat.createMany({
        data: Array.from({ length: quantityTotal }, (_, index) => {
          const seatNumber = String((seatStartNumber ?? 1) + index);
          return {
            ticketTypeId,
            label: `${sectionLabel} · Row ${rowLabel} · Seat ${seatNumber}`,
            sectionLabel,
            rowLabel,
            seatNumber,
            sortOrder: index,
          };
        }),
      });
    }

    return result;
  });

  return NextResponse.json(updated);
}
