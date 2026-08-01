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

  const data: {
    displayName?: string | null;
    avatarUrl?: string | null;
    themePreference?: "system" | "light" | "dark";
    favoriteClubId?: string | null;
    preferredCurrency?: string;
  } = {};
  if (parsed.data.displayName !== undefined) {
    data.displayName = parsed.data.displayName;
  }
  if (parsed.data.preferredCurrency !== undefined) {
    data.preferredCurrency = parsed.data.preferredCurrency;
  }
  if (parsed.data.avatarUrl !== undefined) {
    data.avatarUrl = parsed.data.avatarUrl;
  }
  if (parsed.data.themePreference !== undefined) {
    data.themePreference = parsed.data.themePreference;
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
  const response = NextResponse.json({
    id: updated.id,
    email: updated.email,
    displayName: updated.displayName,
    avatarUrl: updated.avatarUrl,
    themePreference: updated.themePreference,
    favoriteClubId: updated.favoriteClubId,
    preferredCurrency: updated.preferredCurrency,
  });
  if (parsed.data.themePreference) {
    response.cookies.set("matchpass-theme", parsed.data.themePreference, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}
