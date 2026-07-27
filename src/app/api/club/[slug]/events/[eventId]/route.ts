import { NextResponse } from "next/server";
import { canManageClub, getClubApiAccess } from "@/lib/server/auth/clubAccess";
import { prisma } from "@/lib/server/db/prisma";
import { updateClubEventSchema } from "@/lib/shared/schemas/clubDashboard";

export const runtime = "nodejs";

export async function PATCH(
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
  const parsed = updateClubEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.status === "on_sale") {
    const availableTypes = await prisma.ticketType.count({
      where: { eventId, isActive: true },
    });
    if (availableTypes === 0) {
      return NextResponse.json(
        { error: "active_ticket_type_required" },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.venue !== undefined ? { venue: parsed.data.venue } : {}),
      ...(parsed.data.startsAt !== undefined
        ? { startsAt: new Date(parsed.data.startsAt) }
        : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    },
    select: { id: true, status: true },
  });

  return NextResponse.json(updated);
}
