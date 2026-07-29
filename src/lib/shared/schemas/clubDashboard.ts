import { z } from "zod";

export const eventStatusSchema = z.enum([
  "draft",
  "on_sale",
  "sold_out",
  "closed",
  "cancelled",
]);

export const eventLifecycleSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["publish", "unpublish", "close", "archive", "unarchive"]),
  }),
  z.object({
    action: z.literal("cancel"),
    reason: z.string().trim().min(5).max(500),
  }),
]);

export const admissionTypeSchema = z.enum([
  "general_admission",
  "reserved_seating",
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
const nullableLabelSchema = z.string().trim().min(1).max(80).nullable();

const ticketAreaFields = {
  name: z.string().trim().min(2).max(100),
  admissionType: admissionTypeSchema,
  sectionLabel: nullableLabelSchema,
  rowLabel: nullableLabelSchema,
  seatStartNumber: z.number().int().min(1).max(1_000_000).nullable(),
  entranceLabel: nullableLabelSchema,
  accessInstructions: z.string().trim().max(500).nullable(),
  quantityTotal: z.number().int().min(1).max(1_000_000),
  maxPerOrder: z.number().int().min(1).max(50),
  isActive: z.boolean(),
};

export const createTicketAreaSchema = z
  .object(ticketAreaFields)
  .superRefine((value, context) => {
    validateReservedSeatConfiguration(value, context);
  });

export const updateTicketAreaSchema = z
  .object(ticketAreaFields)
  .partial()
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({ code: "custom", message: "At least one field is required." });
    }
  });

const ticketTypeFields = {
  ticketAreaId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).nullable(),
  isTransferable: z.boolean(),
  priceUsdc: priceUsdcSchema,
  quantityTotal: z.number().int().min(1).max(1_000_000),
  maxPerOrder: z.number().int().min(1).max(50),
  isActive: z.boolean(),
  salesStartAt: nullableDateTimeSchema,
  salesEndAt: nullableDateTimeSchema,
};

export const createTicketTypeSchema = z
  .object(ticketTypeFields)
  .superRefine((value, context) => {
    validateSalesWindow(value, context);
  });

export const updateTicketTypeSchema = z
  .object(ticketTypeFields)
  .partial()
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({ code: "custom", message: "At least one field is required." });
    }
    validateSalesWindow(value, context);
  });

function validateSalesWindow(
  value: { salesStartAt?: string | null; salesEndAt?: string | null },
  context: z.RefinementCtx,
) {
  if (!value.salesStartAt || !value.salesEndAt) return;
  if (new Date(value.salesEndAt) <= new Date(value.salesStartAt)) {
    context.addIssue({
      code: "custom",
      path: ["salesEndAt"],
      message: "The sales end must be after the sales start.",
    });
  }
}

function validateReservedSeatConfiguration(
  value: {
    admissionType: "general_admission" | "reserved_seating";
    sectionLabel: string | null;
    rowLabel: string | null;
    seatStartNumber: number | null;
    quantityTotal: number;
  },
  context: z.RefinementCtx,
) {
  if (value.admissionType !== "reserved_seating") return;

  if (value.quantityTotal > 10_000) {
    context.addIssue({
      code: "custom",
      path: ["quantityTotal"],
      message: "Create reserved seating in blocks of no more than 10,000 seats.",
    });
  }

  if (!value.sectionLabel) {
    context.addIssue({ code: "custom", path: ["sectionLabel"], message: "A section is required for reserved seating." });
  }
  if (!value.rowLabel) {
    context.addIssue({ code: "custom", path: ["rowLabel"], message: "A row is required for reserved seating." });
  }
  if (!value.seatStartNumber) {
    context.addIssue({ code: "custom", path: ["seatStartNumber"], message: "A first seat number is required for reserved seating." });
  }
}
