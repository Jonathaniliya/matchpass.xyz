import { z } from "zod";

export const orderItemInputSchema = z.object({
  ticketTypeId: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
});

export const createOrderSchema = z.object({
  eventId: z.string().min(1),
  items: z.array(orderItemInputSchema).min(1).max(8),
}).superRefine((value, context) => {
  const seen = new Set<string>();
  for (const item of value.items) {
    if (seen.has(item.ticketTypeId)) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Each ticket type may only appear once.",
      });
      return;
    }
    seen.add(item.ticketTypeId);
  }
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
