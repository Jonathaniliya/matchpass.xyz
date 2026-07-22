import { Card } from "./Card";
import { ClubBadge } from "./ClubBadge";

export function ClubCard({
  slug,
  name,
  logoEmoji,
  logoUrl,
  leagueName,
}: {
  slug: string;
  name: string;
  logoEmoji?: string | null;
  logoUrl?: string | null;
  leagueName?: string | null;
}) {
  return (
    <Card href={`/clubs/${slug}`} className="flex items-center gap-4">
      <ClubBadge name={name} logoUrl={logoUrl} logoEmoji={logoEmoji} size="md" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium">{name}</h3>
        {leagueName && (
          <p className="mt-0.5 truncate text-xs text-zinc-500">{leagueName}</p>
        )}
      </div>
    </Card>
  );
}
