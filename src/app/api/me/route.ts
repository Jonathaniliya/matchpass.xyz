import { NextResponse } from "next/server";
import { requireFan } from "@/lib/server/auth/requireFan";
import { prisma } from "@/lib/server/db/prisma";
import { updateMeSchema } from "@/lib/shared/schemas/me";

export async function PATCH(req: Request) {
  const fan = await requireFan();
  const json = await req.json().catch(() => null);
  const parsed = updateMeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data: { displayName?: string; favoriteClubId?: string | null; preferredCurrency?: string } = {};
  if (parsed.data.displayName !== undefined) {
    data.displayName = parsed.data.displayName;
  }
  if (parsed.data.preferredCurrency !== undefined) {
    data.preferredCurrency = parsed.data.preferredCurrency;
  }
  if (parsed.data.favoriteClubId !== undefined) {
    if (parsed.data.favoriteClubId === null) {
      data.favoriteClubId = null;
    } else {
      const club = await prisma.club.findUnique({
        where: { id: parsed.data.favoriteClubId },
        select: { id: true },
      });
      if (!club) {
        return NextResponse.json({ error: "club_not_found" }, { status: 400 });
      }
      data.favoriteClubId = club.id;
    }
  }

  const updated = await prisma.fan.update({
    where: { id: fan.id },
    data,
  });
  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    displayName: updated.displayName,
    favoriteClubId: updated.favoriteClubId,
    preferredCurrency: updated.preferredCurrency,
  });
}
