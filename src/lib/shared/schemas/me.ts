import { z } from "zod";

export const updateMeSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  favoriteClubId: z.string().min(1).nullable().optional(),
  preferredCurrency: z.enum(["USDC", "EURC"]).optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
