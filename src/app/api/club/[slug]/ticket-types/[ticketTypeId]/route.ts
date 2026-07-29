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
    parsed.data.ticketAreaId !== undefined &&
    parsed.data.ticketAreaId !== ticketType.ticketAreaId
  ) {
    return NextResponse.json({ error: "ticket_area_locked" }, { status: 409 });
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

    return result;
  });

  return NextResponse.json(updated);
}
