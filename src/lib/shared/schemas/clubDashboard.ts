import { z } from "zod";

export const eventStatusSchema = z.enum([
  "draft",
  "on_sale",
  "sold_out",
  "closed",
]);

const eventFields = {
  name: z.string().trim().min(3).max(120),
  venue: z.string().trim().min(2).max(160),
  startsAt: z.string().datetime(),
};

export const createClubEventSchema = z.object(eventFields);

export const updateClubEventSchema = z
  .object({
    ...eventFields,
    status: eventStatusSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

const priceUsdcSchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}(?:\.\d{1,6})?$/)
  .refine((value) => Number(value) > 0, {
    message: "Price must be greater than zero.",
  });

const nullableDateTimeSchema = z.string().datetime().nullable();

const ticketTypeFields = {
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).nullable(),
  priceUsdc: priceUsdcSchema,
  quantityTotal: z.number().int().min(1).max(1_000_000),
  maxPerOrder: z.number().int().min(1).max(50),
  isActive: z.boolean(),
  salesStartAt: nullableDateTimeSchema,
  salesEndAt: nullableDateTimeSchema,
};

export const createTicketTypeSchema = z
  .object(ticketTypeFields)
  .refine(validSalesWindow, {
    message: "The sales end must be after the sales start.",
    path: ["salesEndAt"],
  });

export const updateTicketTypeSchema = z
  .object(ticketTypeFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

function validSalesWindow(value: {
  salesStartAt?: string | null;
  salesEndAt?: string | null;
}): boolean {
  if (!value.salesStartAt || !value.salesEndAt) return true;
  return new Date(value.salesEndAt) > new Date(value.salesStartAt);
}
