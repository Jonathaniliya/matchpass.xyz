import { Card } from "./Card";
import { ClubBadge } from "./ClubBadge";

export function EventCard({
  id,
  name,
  venue,
  startsAt,
  clubName,
  clubLogoEmoji,
  clubLogoUrl,
}: {
  id: string;
  name: string;
  venue: string;
  startsAt: Date;
  clubName?: string | null;
  clubLogoEmoji?: string | null;
  clubLogoUrl?: string | null;
}) {
  return (
    <Card
      href={`/events/${id}`}
      className="flex items-start gap-4 rounded-3xl p-6"
    >
      <ClubBadge
        name={clubName ?? "Club"}
        logoUrl={clubLogoUrl}
        logoEmoji={clubLogoEmoji}
        size="md"
      />
      <div className="min-w-0 flex-1">
        {clubName && (
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            {clubName}
          </p>
        )}
        <h3 className="mt-1 text-lg font-semibold leading-snug">{name}</h3>
        <p className="mt-2 text-sm text-zinc-400">
          {venue} ·{" "}
          {startsAt.toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
        <p className="mt-3 text-sm text-gradient-accent">View tickets →</p>
      </div>
    </Card>
  );
}
