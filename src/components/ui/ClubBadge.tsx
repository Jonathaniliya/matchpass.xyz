"use client";

import { useState } from "react";

type Size = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<Size, { box: string; text: string; img: string }> = {
  sm: { box: "h-10 w-10", text: "text-xl", img: "h-7 w-7" },
  md: { box: "h-12 w-12", text: "text-2xl", img: "h-8 w-8" },
  lg: { box: "h-14 w-14", text: "text-3xl", img: "h-10 w-10" },
  xl: { box: "h-20 w-20", text: "text-5xl", img: "h-14 w-14" },
};

export function ClubBadge({
  name,
  logoUrl,
  logoEmoji,
  size = "md",
  className = "",
}: {
  name: string;
  logoUrl?: string | null;
  logoEmoji?: string | null;
  size?: Size;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const cls = sizeClasses[size];
  const showImage = logoUrl && !failed;

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-surface-elev ${cls.box} ${cls.text} ${className}`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${name} crest`}
          loading="lazy"
          onError={() => setFailed(true)}
          className={`${cls.img} object-contain`}
        />
      ) : (
        <span>{logoEmoji ?? "⚽"}</span>
      )}
    </div>
  );
}
