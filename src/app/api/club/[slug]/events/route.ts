import { NextResponse } from "next/server";
import { canManageClub, getClubApiAccess } from "@/lib/server/auth/clubAccess";
import { prisma } from "@/lib/server/db/prisma";
import { createClubEventSchema } from "@/lib/shared/schemas/clubDashboard";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const authorization = await getClubApiAccess(slug);
  if (!authorization.authenticated) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!authorization.access || !canManageClub(authorization.access.role)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createClubEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const event = await prisma.event.create({
    data: {
      clubId: authorization.access.clubId,
      name: parsed.data.name,
      venue: parsed.data.venue,
      startsAt: new Date(parsed.data.startsAt),
      status: "draft",
    },
    select: { id: true },
  });

  return NextResponse.json(event, { status: 201 });
}
