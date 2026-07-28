import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { canManageClub, getClubApiAccess } from "@/lib/server/auth/clubAccess";
import { prisma } from "@/lib/server/db/prisma";
import {
  eventLifecycleSchema,
  updateClubEventSchema,
} from "@/lib/shared/schemas/clubDashboard";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string; eventId: string }> };

export async function PATCH(req: Request, { params }: RouteParams) {
  const { slug, eventId } = await params;
  const access = await requireManagementAccess(slug);
  if (access instanceof NextResponse) return access;

  const event = await prisma.event.findFirst({
    where: { id: eventId, clubId: access.clubId },
    select: { id: true },
  });
  if (!event) return notFound();

  const body = await req.json().catch(() => null);
  const lifecycle = eventLifecycleSchema.safeParse(body);
  if (lifecycle.success) {
    try {
      const result = await applyLifecycleAction(eventId, lifecycle.data);
      return NextResponse.json(result);
    } catch (error) {
      return lifecycleErrorResponse(error);
    }
  }

  const parsed = updateClubEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.venue !== undefined ? { venue: parsed.data.venue } : {}),
      ...(parsed.data.startsAt !== undefined
        ? { startsAt: new Date(parsed.data.startsAt) }
        : {}),
    },
    select: { id: true, status: true, archivedAt: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { slug, eventId } = await params;
  const access = await requireManagementAccess(slug);
  if (access instanceof NextResponse) return access;

  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "Event"
        WHERE "id" = ${eventId} AND "clubId" = ${access.clubId}
        FOR UPDATE
      `);
      if (locked.length !== 1) throw new LifecycleError("not_found", 404);

      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: {
          status: true,
          _count: { select: { orders: true, tickets: true } },
        },
      });
      if (!event) throw new LifecycleError("not_found", 404);
      if (event.status !== "draft") {
        throw new LifecycleError("only_unused_drafts_can_be_deleted", 409);
      }
      if (event._count.orders > 0 || event._count.tickets > 0) {
        throw new LifecycleError("event_has_commerce_history", 409);
      }

      await tx.ticketSeat.deleteMany({ where: { ticketType: { eventId } } });
      await tx.ticketType.deleteMany({ where: { eventId } });
      await tx.event.delete({ where: { id: eventId } });
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return lifecycleErrorResponse(error);
  }
}

async function requireManagementAccess(slug: string) {
  const authorization = await getClubApiAccess(slug);
  if (!authorization.authenticated) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!authorization.access || !canManageClub(authorization.access.role)) {
    return notFound();
  }
  return authorization.access;
}

async function applyLifecycleAction(
  eventId: string,
  input:
    | { action: "publish" | "unpublish" | "close" | "archive" | "unarchive" }
    | { action: "cancel"; reason: string },
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE
    `);
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { status: true, archivedAt: true },
    });
    if (!event) throw new LifecycleError("not_found", 404);

    if (input.action === "publish") {
      if (event.status === "cancelled") {
        throw new LifecycleError("cancelled_event_is_terminal", 409);
      }
      const availableTypes = await tx.ticketType.count({
        where: {
          eventId,
          isActive: true,
          quantityTotal: { gt: 0 },
        },
      });
      if (availableTypes === 0) {
        throw new LifecycleError("active_ticket_type_required", 409);
      }
      return tx.event.update({
        where: { id: eventId },
        data: { status: "on_sale", archivedAt: null },
        select: { id: true, status: true, archivedAt: true },
      });
    }

    if (input.action === "unpublish") {
      if (event.status !== "on_sale" && event.status !== "sold_out") {
        throw new LifecycleError("event_is_not_published", 409);
      }
      const orders = await tx.order.count({ where: { eventId } });
      if (orders > 0) {
        throw new LifecycleError("listed_event_has_order_history", 409);
      }
      return tx.event.update({
        where: { id: eventId },
        data: { status: "draft" },
        select: { id: true, status: true, archivedAt: true },
      });
    }

    if (input.action === "close") {
      if (event.status === "cancelled") {
        throw new LifecycleError("cancelled_event_is_terminal", 409);
      }
      return tx.event.update({
        where: { id: eventId },
        data: { status: "closed" },
        select: { id: true, status: true, archivedAt: true },
      });
    }

    if (input.action === "archive") {
      if (event.status !== "closed" && event.status !== "cancelled") {
        throw new LifecycleError("close_or_cancel_before_archiving", 409);
      }
      return tx.event.update({
        where: { id: eventId },
        data: { archivedAt: new Date() },
        select: { id: true, status: true, archivedAt: true },
      });
    }

    if (input.action === "unarchive") {
      return tx.event.update({
        where: { id: eventId },
        data: { archivedAt: null },
        select: { id: true, status: true, archivedAt: true },
      });
    }

    if (input.action !== "cancel") {
      throw new LifecycleError("invalid_lifecycle_action", 400);
    }

    if (event.status === "cancelled") {
      return { id: eventId, status: event.status, archivedAt: event.archivedAt };
    }

    const pendingOrders = await tx.order.findMany({
      where: { eventId, status: "pending" },
      include: { items: true },
      orderBy: { id: "asc" },
    });
    const itemIds = pendingOrders.flatMap((order) => order.items.map((item) => item.id));
    const releases = new Map<string, number>();
    for (const item of pendingOrders.flatMap((order) => order.items)) {
      releases.set(item.ticketTypeId, (releases.get(item.ticketTypeId) ?? 0) + item.quantity);
    }

    await tx.order.updateMany({
      where: { eventId, status: "pending" },
      data: { status: "cancelled" },
    });
    if (itemIds.length > 0) {
      await tx.ticketSeat.updateMany({
        where: { orderItemId: { in: itemIds }, status: "reserved" },
        data: { status: "available", orderItemId: null },
      });
    }
    for (const [ticketTypeId, quantity] of [...releases].sort(([a], [b]) => a.localeCompare(b))) {
      const released = await tx.ticketType.updateMany({
        where: { id: ticketTypeId, quantityReserved: { gte: quantity } },
        data: { quantityReserved: { decrement: quantity } },
      });
      if (released.count !== 1) {
        throw new LifecycleError("inventory_release_invariant_failed", 500);
      }
    }

    const refunds = await tx.order.updateMany({
      where: { eventId, status: { in: ["paid", "fulfilled", "review"] } },
      data: { status: "refund_pending" },
    });
    await tx.qrToken.updateMany({
      where: { ticket: { eventId }, status: "active" },
      data: { status: "revoked" },
    });
    await tx.ticket.updateMany({
      where: { eventId, status: "issued" },
      data: { status: "void" },
    });
    const cancelled = await tx.event.update({
      where: { id: eventId },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: input.reason,
      },
      select: { id: true, status: true, archivedAt: true },
    });
    return { ...cancelled, refundOrders: refunds.count };
  });
}

class LifecycleError extends Error {
  constructor(
    code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

function lifecycleErrorResponse(error: unknown) {
  if (error instanceof LifecycleError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("event_lifecycle_failed", error);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
