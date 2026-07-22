import { Card } from "./Card";
import { ClubBadge } from "./ClubBadge";

export function LeagueCard({
  slug,
  name,
  country,
  logoEmoji,
  logoUrl,
  clubCount,
}: {
  slug: string;
  name: string;
  country?: string | null;
  logoEmoji?: string | null;
  logoUrl?: string | null;
  clubCount?: number;
}) {
  return (
    <Card href={`/leagues/${slug}`} className="flex items-center gap-4">
      <ClubBadge name={name} logoUrl={logoUrl} logoEmoji={logoEmoji} size="lg" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold">{name}</h3>
        <p className="mt-0.5 truncate text-xs text-zinc-400">
          {country ?? "Football"}
          {typeof clubCount === "number" ? ` · ${clubCount} clubs` : ""}
        </p>
      </div>
      <span className="text-zinc-500">→</span>
    </Card>
  );
}
