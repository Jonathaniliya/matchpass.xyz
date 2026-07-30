import { z } from "zod";

const evmAddress = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid 0x wallet address");

const usdcAmount = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,6})?$/, "Enter a USDC amount with up to 6 decimals")
  .refine((value) => Number(value) > 0, "Amount must be greater than zero");

export const createWalletTransferSchema = z.discriminatedUnion("purpose", [
  z.object({
    purpose: z.literal("withdrawal"),
    destinationAddress: evmAddress,
    amount: usdcAmount,
  }),
  z.object({
    purpose: z.literal("order_payment"),
    orderId: z.string().cuid(),
  }),
]);

export const walletChallengeStatusSchema = z.object({
  status: z.enum(["COMPLETE", "FAILED", "EXPIRED"]),
  error: z.string().trim().max(500).optional(),
});

export type CreateWalletTransferInput = z.infer<
  typeof createWalletTransferSchema
>;
