import { NextResponse } from "next/server";
import { canManageClub, getClubApiAccess } from "@/lib/server/auth/clubAccess";
import { prisma } from "@/lib/server/db/prisma";
import { updateTicketAreaSchema } from "@/lib/shared/schemas/clubDashboard";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; ticketAreaId: string }> },
) {
  const { slug, ticketAreaId } = await params;
  const authorization = await getClubApiAccess(slug);
  if (!authorization.authenticated) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!authorization.access || !canManageClub(authorization.access.role)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const area = await prisma.ticketArea.findFirst({
    where: { id: ticketAreaId, event: { clubId: authorization.access.clubId } },
  });
  if (!area) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateTicketAreaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const quantityTotal = parsed.data.quantityTotal ?? area.quantityTotal;
  if (quantityTotal < area.quantityReserved + area.quantitySold) {
    return NextResponse.json({ error: "quantity_below_committed_inventory" }, { status: 409 });
  }
  if (
    parsed.data.admissionType !== undefined &&
    parsed.data.admissionType !== area.admissionType
  ) {
    return NextResponse.json({ error: "admission_type_locked" }, { status: 409 });
  }

  const sectionLabel =
    parsed.data.sectionLabel === undefined ? area.sectionLabel : parsed.data.sectionLabel;
  const rowLabel = parsed.data.rowLabel === undefined ? area.rowLabel : parsed.data.rowLabel;
  const seatStartNumber =
    parsed.data.seatStartNumber === undefined
      ? area.seatStartNumber
      : parsed.data.seatStartNumber;
  const reservedStructureChanged =
    area.admissionType === "reserved_seating" &&
    (quantityTotal !== area.quantityTotal ||
      sectionLabel !== area.sectionLabel ||
      rowLabel !== area.rowLabel ||
      seatStartNumber !== area.seatStartNumber);

  if (reservedStructureChanged && area.quantityReserved + area.quantitySold > 0) {
    return NextResponse.json({ error: "seat_inventory_locked" }, { status: 409 });
  }
  if (
    area.admissionType === "reserved_seating" &&
    (!sectionLabel || !rowLabel || !seatStartNumber)
  ) {
    return NextResponse.json(
      { error: "reserved_seat_configuration_required" },
      { status: 400 },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.ticketArea.update({
      where: { id: area.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.sectionLabel !== undefined ? { sectionLabel } : {}),
        ...(parsed.data.rowLabel !== undefined ? { rowLabel } : {}),
        ...(parsed.data.seatStartNumber !== undefined ? { seatStartNumber } : {}),
        ...(parsed.data.entranceLabel !== undefined
          ? { entranceLabel: parsed.data.entranceLabel }
          : {}),
        ...(parsed.data.accessInstructions !== undefined
          ? { accessInstructions: parsed.data.accessInstructions }
          : {}),
        ...(parsed.data.quantityTotal !== undefined ? { quantityTotal } : {}),
        ...(parsed.data.maxPerOrder !== undefined
          ? { maxPerOrder: parsed.data.maxPerOrder }
          : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
      select: { id: true },
    });

    if (reservedStructureChanged) {
      await tx.ticketSeat.deleteMany({ where: { ticketAreaId: area.id } });
      await tx.ticketSeat.createMany({
        data: Array.from({ length: quantityTotal }, (_, index) => {
          const seatNumber = String((seatStartNumber ?? 1) + index);
          return {
            ticketAreaId: area.id,
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
