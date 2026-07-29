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
  fallback = "emoji",
  size = "md",
  className = "",
}: {
  name: string;
  logoUrl?: string | null;
  logoEmoji?: string | null;
  fallback?: "emoji" | "stadium";
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
      ) : fallback === "stadium" ? (
        <StadiumIcon className={`${cls.img} text-cyan-300`} />
      ) : (
        <span>{logoEmoji ?? "⚽"}</span>
      )}
    </div>
  );
}

function StadiumIcon({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M5.5 7.25h13l2.25 4.25H3.25L5.5 7.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4.25 11.5v7.25h15.5V11.5M8.25 18.75v-3a3.75 3.75 0 0 1 7.5 0v3M7.25 7.25V5.5M16.75 7.25V5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 18.75h19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
