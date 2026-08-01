type ProfileAvatarProps = {
  avatarUrl: string | null;
  displayName: string | null;
  email: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-sm",
  lg: "h-20 w-20 text-xl",
};

export function ProfileAvatar({
  avatarUrl,
  displayName,
  email,
  size = "md",
}: ProfileAvatarProps) {
  const label = displayName?.trim() || email;
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "MP";

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-elev font-semibold text-cyan-300 ${sizeClasses[size]}`}
      aria-label={`${label} avatar`}
    >
      {initials}
      {avatarUrl && (
        // User-provided HTTP(S) profile images can come from arbitrary NFT or
        // avatar hosts, so they intentionally bypass Next's host allow-list.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}
