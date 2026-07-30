import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const day = 1000 * 60 * 60 * 24;
const inDays = (n: number) => new Date(Date.now() + day * n);

type SeedLeague = {
  slug: string;
  name: string;
  country: string;
  logoEmoji: string;
  logoUrl: string;
  tier: number;
};

type SeedClub = {
  slug: string;
  name: string;
  logoEmoji: string;
  logoUrl: string;
  leagueSlug: string;
  featured?: boolean;
};

type SeedEvent = {
  id: string;
  clubSlug: string;
  name: string;
  venue: string;
  inDays: number;
  ticketTypes: Array<{ id: string; name: string; priceUsdc: string; quantityTotal: number }>;
};

const leagues: SeedLeague[] = [
  {
    slug: "premier-league",
    name: "English Premier League",
    country: "England",
    logoEmoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg",
    tier: 10,
  },
  {
    slug: "la-liga",
    name: "LaLiga Santander",
    country: "Spain",
    logoEmoji: "🇪🇸",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/13/LaLiga.svg",
    tier: 20,
  },
  {
    slug: "ligue-1",
    name: "Ligue 1",
    country: "France",
    logoEmoji: "🇫🇷",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/b/b8/Ligue1.svg",
    tier: 30,
  },
  {
    slug: "bundesliga",
    name: "Bundesliga",
    country: "Germany",
    logoEmoji: "🇩🇪",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/d/df/Bundesliga_logo_%282017%29.svg",
    tier: 40,
  },
];

const clubs: SeedClub[] = [
  // English Premier League — top 4
  {
    slug: "manchester-city",
    name: "Manchester City",
    logoEmoji: "🩵",
    logoUrl: "/club-badges/manchester-city.png",
    leagueSlug: "premier-league",
    featured: true,
  },
  {
    slug: "arsenal",
    name: "Arsenal",
    logoEmoji: "🔴",
    logoUrl: "/club-badges/arsenal.png",
    leagueSlug: "premier-league",
    featured: true,
  },
  {
    slug: "chelsea",
    name: "Chelsea",
    logoEmoji: "🔵",
    logoUrl: "/club-badges/chelsea.png",
    leagueSlug: "premier-league",
    featured: true,
  },
  {
    slug: "manchester-united",
    name: "Manchester United",
    logoEmoji: "🔴",
    logoUrl: "/club-badges/manchester-united.png",
    leagueSlug: "premier-league",
    featured: true,
  },
  // LaLiga Santander — top 4
  {
    slug: "barcelona",
    name: "FC Barcelona",
    logoEmoji: "🔵",
    logoUrl: "/club-badges/barcelona.png",
    leagueSlug: "la-liga",
    featured: true,
  },
  {
    slug: "real-madrid",
    name: "Real Madrid",
    logoEmoji: "⚪",
    logoUrl: "/club-badges/real-madrid.png",
    leagueSlug: "la-liga",
    featured: true,
  },
  {
    slug: "atletico-madrid",
    name: "Atlético Madrid",
    logoEmoji: "🟥",
    logoUrl: "/club-badges/atletico-madrid.png",
    leagueSlug: "la-liga",
    featured: true,
  },
  {
    slug: "real-betis",
    name: "Real Betis",
    logoEmoji: "🟩",
    logoUrl: "/club-badges/real-betis.png",
    leagueSlug: "la-liga",
    featured: true,
  },
  // Ligue 1 — top 4
  {
    slug: "monaco",
    name: "AS Monaco",
    logoEmoji: "🔴",
    logoUrl: "/club-badges/monaco.png",
    leagueSlug: "ligue-1",
    featured: true,
  },
  {
    slug: "psg",
    name: "Paris Saint-Germain",
    logoEmoji: "🟦",
    logoUrl: "/club-badges/psg.png",
    leagueSlug: "ligue-1",
    featured: true,
  },
  {
    slug: "marseille",
    name: "Olympique de Marseille",
    logoEmoji: "🔱",
    logoUrl: "/club-badges/marseille.png",
    leagueSlug: "ligue-1",
    featured: true,
  },
  {
    slug: "lyon",
    name: "Olympique Lyonnais",
    logoEmoji: "🔵",
    logoUrl: "/club-badges/lyon.png",
    leagueSlug: "ligue-1",
    featured: true,
  },
  // Bundesliga — top 4
  {
    slug: "bayern-munich",
    name: "FC Bayern München",
    logoEmoji: "🅱️",
    logoUrl: "/club-badges/bayern-munich.png",
    leagueSlug: "bundesliga",
    featured: true,
  },
  {
    slug: "borussia-dortmund",
    name: "Borussia Dortmund",
    logoEmoji: "🟡",
    logoUrl: "/club-badges/borussia-dortmund.png",
    leagueSlug: "bundesliga",
    featured: true,
  },
  {
    slug: "bayer-leverkusen",
    name: "Bayer 04 Leverkusen",
    logoEmoji: "🟥",
    logoUrl: "/club-badges/bayer-leverkusen.png",
    leagueSlug: "bundesliga",
    featured: true,
  },
  {
    slug: "rb-leipzig",
    name: "RB Leipzig",
    logoEmoji: "🔵",
    logoUrl: "/club-badges/rb-leipzig.png",
    leagueSlug: "bundesliga",
    featured: true,
  },
];

const events: SeedEvent[] = [
  {
    id: "evt-arsenal-mancity",
    clubSlug: "arsenal",
    name: "Arsenal vs Manchester City",
    venue: "Emirates Stadium",
    inDays: 10,
    ticketTypes: [
      { id: "tt-arsenal-stand", name: "Standing", priceUsdc: "1.00", quantityTotal: 1200 },
      { id: "tt-arsenal-seat", name: "Seated", priceUsdc: "2.00", quantityTotal: 800 },
    ],
  },
  {
    id: "evt-realmadrid-barca",
    clubSlug: "real-madrid",
    name: "Real Madrid vs FC Barcelona — El Clásico",
    venue: "Santiago Bernabéu",
    inDays: 21,
    ticketTypes: [
      { id: "tt-clasico-stand", name: "Standing", priceUsdc: "1.00", quantityTotal: 2000 },
      { id: "tt-clasico-seat", name: "Seated", priceUsdc: "2.00", quantityTotal: 1500 },
    ],
  },
  {
    id: "evt-bayern-bvb",
    clubSlug: "bayern-munich",
    name: "Bayern München vs Borussia Dortmund — Der Klassiker",
    venue: "Allianz Arena",
    inDays: 17,
    ticketTypes: [
      { id: "tt-derklassiker-stand", name: "Südkurve Standing", priceUsdc: "1.00", quantityTotal: 1800 },
      { id: "tt-derklassiker-seat", name: "Seated", priceUsdc: "2.00", quantityTotal: 1000 },
    ],
  },
  {
    id: "evt-psg-marseille",
    clubSlug: "psg",
    name: "Paris Saint-Germain vs Olympique Marseille — Le Classique",
    venue: "Parc des Princes",
    inDays: 12,
    ticketTypes: [
      { id: "tt-classique-stand", name: "Standing", priceUsdc: "1.00", quantityTotal: 1400 },
      { id: "tt-classique-seat", name: "Seated", priceUsdc: "2.00", quantityTotal: 900 },
    ],
  },
];

async function main() {
  const leagueBySlug = new Map<string, string>();
  for (const l of leagues) {
    const row = await prisma.league.upsert({
      where: { slug: l.slug },
      update: {
        name: l.name,
        country: l.country,
        logoEmoji: l.logoEmoji,
        logoUrl: l.logoUrl,
        tier: l.tier,
      },
      create: {
        slug: l.slug,
        name: l.name,
        country: l.country,
        logoEmoji: l.logoEmoji,
        logoUrl: l.logoUrl,
        tier: l.tier,
      },
    });
    leagueBySlug.set(l.slug, row.id);
  }

  const clubBySlug = new Map<string, string>();
  for (const c of clubs) {
    const leagueId = leagueBySlug.get(c.leagueSlug);
    const row = await prisma.club.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        logoEmoji: c.logoEmoji,
        logoUrl: c.logoUrl,
        leagueId,
        featured: c.featured ?? false,
      },
      create: {
        slug: c.slug,
        name: c.name,
        logoEmoji: c.logoEmoji,
        logoUrl: c.logoUrl,
        leagueId,
        featured: c.featured ?? false,
      },
    });
    clubBySlug.set(c.slug, row.id);
  }

  for (const e of events) {
    const clubId = clubBySlug.get(e.clubSlug);
    if (!clubId) throw new Error(`Unknown club slug in event seed: ${e.clubSlug}`);
    await prisma.event.upsert({
      where: { id: e.id },
      update: { name: e.name, venue: e.venue, startsAt: inDays(e.inDays) },
      create: {
        id: e.id,
        clubId,
        name: e.name,
        venue: e.venue,
        startsAt: inDays(e.inDays),
        status: "on_sale",
      },
    });
    for (const tt of e.ticketTypes) {
      const reservedSeating = tt.id.endsWith("-seat");
      const ticketAreaId = `area-${tt.id}`;
      await prisma.ticketArea.upsert({
        where: { id: ticketAreaId },
        update: {
          name: tt.name,
          admissionType: reservedSeating ? "reserved_seating" : "general_admission",
          sectionLabel: tt.name,
          rowLabel: reservedSeating ? "A" : null,
          seatStartNumber: reservedSeating ? 1 : null,
          quantityTotal: tt.quantityTotal,
        },
        create: {
          id: ticketAreaId,
          eventId: e.id,
          name: tt.name,
          admissionType: reservedSeating ? "reserved_seating" : "general_admission",
          sectionLabel: tt.name,
          rowLabel: reservedSeating ? "A" : null,
          seatStartNumber: reservedSeating ? 1 : null,
          quantityTotal: tt.quantityTotal,
          ...(reservedSeating
            ? {
                seats: {
                  create: Array.from({ length: tt.quantityTotal }, (_, index) => {
                    const seatNumber = String(index + 1);
                    return {
                      label: `${tt.name} · Row A · Seat ${seatNumber}`,
                      sectionLabel: tt.name,
                      rowLabel: "A",
                      seatNumber,
                      sortOrder: index,
                    };
                  }),
                },
              }
            : {}),
        },
      });
      await prisma.ticketType.upsert({
        where: { id: tt.id },
        update: {
          ticketAreaId,
          name: "Adult",
          priceUsdc: tt.priceUsdc,
          quantityTotal: tt.quantityTotal,
        },
        create: {
          id: tt.id,
          eventId: e.id,
          ticketAreaId,
          name: "Adult",
          priceUsdc: tt.priceUsdc,
          quantityTotal: tt.quantityTotal,
        },
      });
    }
  }

  console.log("Seed complete:", {
    leagues: leagues.length,
    clubs: clubs.length,
    events: events.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
