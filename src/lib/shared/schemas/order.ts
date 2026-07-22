import { z } from "zod";

export const orderItemInputSchema = z.object({
  ticketTypeId: z.string().min(1),
  quantity: z.number().int().min(1).max(10),
});

export const createOrderSchema = z.object({
  eventId: z.string().min(1),
  items: z.array(orderItemInputSchema).min(1).max(8),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
