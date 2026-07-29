-- A TicketArea owns the physical allocation (or GA capacity). TicketType now
-- represents the fare a fan chooses, such as Adult or Junior, within that area.
CREATE TABLE "TicketArea" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "admissionType" "AdmissionType" NOT NULL DEFAULT 'general_admission',
    "sectionLabel" TEXT,
    "rowLabel" TEXT,
    "seatStartNumber" INTEGER,
    "entranceLabel" TEXT,
    "accessInstructions" TEXT,
    "quantityTotal" INTEGER NOT NULL,
    "quantityReserved" INTEGER NOT NULL DEFAULT 0,
    "quantitySold" INTEGER NOT NULL DEFAULT 0,
    "maxPerOrder" INTEGER NOT NULL DEFAULT 8,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketArea_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TicketArea_quantityTotal_nonnegative" CHECK ("quantityTotal" >= 0),
    CONSTRAINT "TicketArea_quantityReserved_nonnegative" CHECK ("quantityReserved" >= 0),
    CONSTRAINT "TicketArea_quantitySold_nonnegative" CHECK ("quantitySold" >= 0),
    CONSTRAINT "TicketArea_inventory_within_total" CHECK ("quantityReserved" + "quantitySold" <= "quantityTotal"),
    CONSTRAINT "TicketArea_maxPerOrder_positive" CHECK ("maxPerOrder" > 0),
    CONSTRAINT "TicketArea_seatStartNumber_positive" CHECK ("seatStartNumber" IS NULL OR "seatStartNumber" > 0)
);

-- Every existing ticket type becomes a one-to-one legacy area. This preserves
-- all live inventory and lets clubs add multiple fare categories safely later.
INSERT INTO "TicketArea" (
    "id", "eventId", "name", "admissionType", "sectionLabel", "rowLabel",
    "seatStartNumber", "entranceLabel", "accessInstructions", "quantityTotal",
    "quantityReserved", "quantitySold", "maxPerOrder", "isActive", "createdAt", "updatedAt"
)
SELECT
    'legacy-area-' || "id",
    "eventId",
    CASE
      WHEN "admissionType" = 'reserved_seating' THEN concat_ws(' · ', "sectionLabel", 'Row ' || "rowLabel")
      ELSE COALESCE("sectionLabel", 'General admission')
    END,
    "admissionType", "sectionLabel", "rowLabel", "seatStartNumber", "entranceLabel",
    "accessInstructions", "quantityTotal", "quantityReserved", "quantitySold",
    "maxPerOrder", "isActive", "createdAt", "updatedAt"
FROM "TicketType";

ALTER TABLE "TicketType" ADD COLUMN "ticketAreaId" TEXT;
UPDATE "TicketType" SET "ticketAreaId" = 'legacy-area-' || "id";
ALTER TABLE "TicketType" ALTER COLUMN "ticketAreaId" SET NOT NULL;

ALTER TABLE "TicketSeat" ADD COLUMN "ticketAreaId" TEXT;
UPDATE "TicketSeat" SET "ticketAreaId" = 'legacy-area-' || "ticketTypeId";

-- Previous releases created seats when a reserved ticket type was created.
-- This fallback preserves any older reserved ticket types that predate that UI.
INSERT INTO "TicketSeat" (
    "id", "ticketTypeId", "ticketAreaId", "label", "sectionLabel", "rowLabel",
    "seatNumber", "sortOrder", "status", "createdAt", "updatedAt"
)
SELECT
    'legacy-seat-' || tt."id" || '-' || series.n,
    tt."id",
    'legacy-area-' || tt."id",
    tt."sectionLabel" || ' · Row ' || tt."rowLabel" || ' · Seat ' || (tt."seatStartNumber" + series.n - 1),
    tt."sectionLabel",
    tt."rowLabel",
    (tt."seatStartNumber" + series.n - 1)::TEXT,
    series.n - 1,
    'available'::"TicketSeatStatus",
    tt."createdAt",
    tt."updatedAt"
FROM "TicketType" tt
CROSS JOIN LATERAL generate_series(1, tt."quantityTotal") AS series(n)
WHERE tt."admissionType" = 'reserved_seating'
  AND NOT EXISTS (
    SELECT 1 FROM "TicketSeat" seat WHERE seat."ticketTypeId" = tt."id"
  );

ALTER TABLE "TicketSeat" ALTER COLUMN "ticketAreaId" SET NOT NULL;

ALTER TABLE "TicketSeat" DROP CONSTRAINT "TicketSeat_ticketTypeId_fkey";
DROP INDEX "TicketSeat_ticketTypeId_label_key";
DROP INDEX "TicketSeat_ticketTypeId_status_sortOrder_idx";
ALTER TABLE "TicketSeat" DROP COLUMN "ticketTypeId";

ALTER TABLE "TicketType"
DROP CONSTRAINT "TicketType_seatStartNumber_positive",
DROP COLUMN "admissionType",
DROP COLUMN "sectionLabel",
DROP COLUMN "rowLabel",
DROP COLUMN "seatStartNumber",
DROP COLUMN "entranceLabel",
DROP COLUMN "accessInstructions";

CREATE INDEX "TicketType_ticketAreaId_idx" ON "TicketType"("ticketAreaId");
CREATE UNIQUE INDEX "TicketSeat_ticketAreaId_label_key" ON "TicketSeat"("ticketAreaId", "label");
CREATE INDEX "TicketSeat_ticketAreaId_status_sortOrder_idx" ON "TicketSeat"("ticketAreaId", "status", "sortOrder");
CREATE INDEX "TicketArea_eventId_isActive_idx" ON "TicketArea"("eventId", "isActive");

ALTER TABLE "TicketArea" ADD CONSTRAINT "TicketArea_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_ticketAreaId_fkey"
FOREIGN KEY ("ticketAreaId") REFERENCES "TicketArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketSeat" ADD CONSTRAINT "TicketSeat_ticketAreaId_fkey"
FOREIGN KEY ("ticketAreaId") REFERENCES "TicketArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The app uses its server-side Prisma role. Keeping this public-schema table
-- behind RLS prevents accidental exposure via Supabase's Data API.
ALTER TABLE "TicketArea" ENABLE ROW LEVEL SECURITY;
