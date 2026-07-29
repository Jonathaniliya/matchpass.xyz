import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: ".env.local", quiet: true });

const API_BASE_URL = "https://api.football-data.org/v4";
const COMPETITION_CODE = "PL";
const apiKey = process.env.FOOTBALL_DATA_API_KEY;
const dryRun = process.argv.includes("--dry-run");
const season = parseSeason(process.env.PREMIER_LEAGUE_SEASON);

if (!apiKey) {
  throw new Error(
    "FOOTBALL_DATA_API_KEY is missing. Add it to .env.local before importing fixtures.",
  );
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString && !dryRun) {
  throw new Error("DIRECT_URL or DATABASE_URL is required to import fixtures.");
}

const prisma = connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : null;

type ApiTeam = {
  id: number;
  name: string;
  shortName: string;
  crest: string | null;
  venue: string | null;
};

type ApiMatchTeam = {
  id: number;
  name: string;
  shortName: string;
};

type ApiMatch = {
  id: number;
  utcDate: string;
  matchday: number | null;
  homeTeam: ApiMatchTeam;
  awayTeam: ApiMatchTeam;
};

type TeamsResponse = {
  competition: { name: string; emblem: string | null };
  teams: ApiTeam[];
};

type MatchesResponse = {
  matches: ApiMatch[];
};

const existingSeedSlugs: Record<string, string> = {
  "arsenal fc": "arsenal",
  "chelsea fc": "chelsea",
  "manchester city fc": "manchester-city",
  "manchester united fc": "manchester-united",
};

async function main() {
  const [teamsPayload, matchesPayload] = await Promise.all([
    footballData<TeamsResponse>(`/competitions/${COMPETITION_CODE}/teams?season=${season}`),
    footballData<MatchesResponse>(`/competitions/${COMPETITION_CODE}/matches?season=${season}`),
  ]);

  if (teamsPayload.teams.length !== 20) {
    throw new Error(
      `Expected 20 Premier League clubs for ${season}/${season + 1}, received ${teamsPayload.teams.length}.`,
    );
  }
  if (matchesPayload.matches.length !== 380) {
    throw new Error(
      `Expected 380 Premier League fixtures for ${season}/${season + 1}, received ${matchesPayload.matches.length}.`,
    );
  }

  if (dryRun) {
    console.log({
      dryRun: true,
      season: `${season}/${season + 1}`,
      clubs: teamsPayload.teams.length,
      fixtures: matchesPayload.matches.length,
      firstFixture: fixtureName(matchesPayload.matches[0]),
      lastFixture: fixtureName(matchesPayload.matches.at(-1)),
    });
    return;
  }
  if (!prisma) throw new Error("Prisma client is unavailable.");

  const league = await prisma.league.upsert({
    where: { slug: "premier-league" },
    update: {
      name: teamsPayload.competition.name,
      country: "England",
      logoUrl: teamsPayload.competition.emblem,
      tier: 10,
    },
    create: {
      slug: "premier-league",
      name: teamsPayload.competition.name,
      country: "England",
      logoUrl: teamsPayload.competition.emblem,
      tier: 10,
    },
  });

  const clubsByProviderId = new Map<
    number,
    { id: string; name: string; venue: string | null }
  >();
  for (const team of teamsPayload.teams) {
    const slug = clubSlug(team);
    const displayName = team.shortName || stripFootballSuffix(team.name);
    const club = await prisma.club.upsert({
      where: { slug },
      update: {
        name: displayName,
        leagueId: league.id,
        logoUrl: team.crest,
        featured: true,
      },
      create: {
        slug,
        name: displayName,
        leagueId: league.id,
        logoUrl: team.crest,
        featured: true,
      },
    });
    clubsByProviderId.set(team.id, {
      id: club.id,
      name: club.name,
      venue: team.venue,
    });
  }

  let created = 0;
  let updatedDrafts = 0;
  let preservedLiveEvents = 0;

  for (const match of matchesPayload.matches) {
    const home = clubsByProviderId.get(match.homeTeam.id);
    const away = clubsByProviderId.get(match.awayTeam.id);
    if (!home || !away) {
      throw new Error(`Fixture ${match.id} references an unknown Premier League club.`);
    }

    const id = `football-data-pl-${match.id}`;
    const startsAt = new Date(match.utcDate);
    if (Number.isNaN(startsAt.getTime())) {
      throw new Error(`Fixture ${match.id} has an invalid kickoff time.`);
    }
    const data = {
      clubId: home.id,
      name: `${home.name} vs ${away.name}`,
      venue: home.venue || "Venue TBC",
      startsAt,
    };
    const existing = await prisma.event.findUnique({
      where: { id },
      select: { status: true, archivedAt: true },
    });

    if (!existing) {
      await prisma.event.create({
        data: { id, ...data, status: "draft" },
      });
      created += 1;
    } else if (existing.status === "draft" && !existing.archivedAt) {
      await prisma.event.update({ where: { id }, data });
      updatedDrafts += 1;
    } else {
      preservedLiveEvents += 1;
    }
  }

  console.log({
    season: `${season}/${season + 1}`,
    clubs: clubsByProviderId.size,
    fixtures: matchesPayload.matches.length,
    created,
    updatedDrafts,
    preservedLiveEvents,
  });
}

async function footballData<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "X-Auth-Token": apiKey! },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Football-Data.org request failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }
  return (await response.json()) as T;
}

function parseSeason(value: string | undefined): number {
  if (value) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed >= 2020 && parsed <= 2100) return parsed;
    throw new Error("PREMIER_LEAGUE_SEASON must be the four-digit starting year.");
  }
  const now = new Date();
  return now.getUTCMonth() >= 6
    ? now.getUTCFullYear()
    : now.getUTCFullYear() - 1;
}

function clubSlug(team: ApiTeam): string {
  return (
    existingSeedSlugs[team.name.toLowerCase()] ??
    slugify(team.shortName || stripFootballSuffix(team.name))
  );
}

function stripFootballSuffix(name: string): string {
  return name.replace(/\s+(?:AFC|FC)$/i, "").trim();
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function fixtureName(match: ApiMatch | undefined): string | null {
  return match
    ? `${match.homeTeam.shortName || match.homeTeam.name} vs ${match.awayTeam.shortName || match.awayTeam.name}`
    : null;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
