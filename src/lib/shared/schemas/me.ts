import { z } from "zod";

export const updateMeSchema = z.object({
  displayName: z.string().trim().min(1).max(60).nullable().optional(),
  avatarUrl: z
    .string()
    .trim()
    .url()
    .max(2048)
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
      message: "Avatar URL must use HTTP or HTTPS",
    })
    .nullable()
    .optional(),
  themePreference: z.enum(["system", "light", "dark"]).optional(),
  favoriteClubId: z.string().min(1).nullable().optional(),
  preferredCurrency: z.literal("USDC").optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
