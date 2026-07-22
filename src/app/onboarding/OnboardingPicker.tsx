"use client";

import { useRouter } from "next/navigation";
import {
  FavoriteTeamsModal,
  type FeaturedClub,
} from "@/components/ui/FavoriteTeamsModal";

export function OnboardingPicker({ clubs }: { clubs: FeaturedClub[] }) {
  const router = useRouter();
  return (
    <FavoriteTeamsModal
      clubs={clubs}
      onDone={() => {
        router.push("/");
        router.refresh();
      }}
    />
  );
}
