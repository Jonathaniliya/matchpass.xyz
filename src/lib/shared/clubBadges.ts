const featuredClubBadges: Record<string, string> = {
  "manchester-city": "/club-badges/manchester-city.png",
  arsenal: "/club-badges/arsenal.png",
  chelsea: "/club-badges/chelsea.png",
  "manchester-united": "/club-badges/manchester-united.png",
  barcelona: "/club-badges/barcelona.png",
  "real-madrid": "/club-badges/real-madrid.png",
  "atletico-madrid": "/club-badges/atletico-madrid.png",
  "real-betis": "/club-badges/real-betis.png",
  monaco: "/club-badges/monaco.png",
  psg: "/club-badges/psg.png",
  marseille: "/club-badges/marseille.png",
  lyon: "/club-badges/lyon.png",
  "bayern-munich": "/club-badges/bayern-munich.png",
  "borussia-dortmund": "/club-badges/borussia-dortmund.png",
  "bayer-leverkusen": "/club-badges/bayer-leverkusen.png",
  "rb-leipzig": "/club-badges/rb-leipzig.png",
};

export function getClubBadgeUrl(slug: string, fallbackUrl: string | null) {
  return featuredClubBadges[slug] ?? fallbackUrl;
}
