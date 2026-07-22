import { z } from "zod";

export const gateScanSchema = z.object({
  qrPayload: z.string().min(10).max(500),
});

export const gateLoginSchema = z.object({
  password: z.string().min(1),
});

export type GateScanInput = z.infer<typeof gateScanSchema>;
