import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFan } from "@/lib/server/auth/requireFan";
import { prisma } from "@/lib/server/db/prisma";

const saveSchema = z.object({
  clubIds: z.array(z.string().min(1)).max(20),
});

export async function GET() {
  const fan = await requireFan();
  const favorites = await prisma.fanFavoriteClub.findMany({
    where: { fanId: fan.id },
    include: {
      club: {
        include: {
          league: { select: { name: true, slug: true, country: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    favorites.map((f) => ({
      clubId: f.clubId,
      name: f.club.name,
      logoEmoji: f.club.logoEmoji,
      logoUrl: f.club.logoUrl,
      league: f.club.league,
    })),
  );
}

export async function POST(req: Request) {
  const fan = await requireFan();
  const json = await req.json().catch(() => null);
  const parsed = saveSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { clubIds } = parsed.data;

  if (clubIds.length > 0) {
    const existing = await prisma.club.findMany({
      where: { id: { in: clubIds } },
      select: { id: true },
    });
    if (existing.length !== clubIds.length) {
      return NextResponse.json({ error: "invalid_club_ids" }, { status: 400 });
    }
  }

  await prisma.$transaction([
    prisma.fanFavoriteClub.deleteMany({ where: { fanId: fan.id } }),
    ...clubIds.map((clubId) =>
      prisma.fanFavoriteClub.create({ data: { fanId: fan.id, clubId } }),
    ),
  ]);

  return NextResponse.json({ ok: true });
}
