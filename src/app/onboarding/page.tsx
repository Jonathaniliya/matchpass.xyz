import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/db/prisma";
import { requireFan } from "@/lib/server/auth/requireFan";
import { OnboardingPicker } from "./OnboardingPicker";
import type { FeaturedClub } from "@/components/ui/FavoriteTeamsModal";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const fan = await requireFan();

  const existingFavorites = await prisma.fanFavoriteClub.count({
    where: { fanId: fan.id },
  });
  if (existingFavorites > 0) redirect("/");

  const clubs = await prisma.club.findMany({
    where: { featured: true },
    orderBy: [{ league: { tier: "asc" } }, { name: "asc" }],
    include: {
      league: { select: { name: true, slug: true, country: true } },
    },
  });

  const options: FeaturedClub[] = clubs.map((c) => ({
    id: c.id,
    name: c.name,
    logoEmoji: c.logoEmoji,
    logoUrl: c.logoUrl,
    league: c.league
      ? { name: c.league.name, slug: c.league.slug, country: c.league.country }
      : null,
  }));

  return <OnboardingPicker clubs={options} />;
}
