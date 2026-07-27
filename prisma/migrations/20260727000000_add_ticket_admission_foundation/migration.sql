CREATE TYPE "AdmissionType" AS ENUM ('general_admission', 'reserved_seating');
CREATE TYPE "TicketSeatStatus" AS ENUM ('available', 'reserved', 'sold', 'blocked');

ALTER TABLE "TicketType"
ADD COLUMN "admissionType" "AdmissionType" NOT NULL DEFAULT 'general_admission',
ADD COLUMN "sectionLabel" TEXT,
ADD COLUMN "rowLabel" TEXT,
ADD COLUMN "seatStartNumber" INTEGER,
ADD COLUMN "entranceLabel" TEXT,
ADD COLUMN "accessInstructions" TEXT,
ADD COLUMN "isTransferable" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Ticket"
ADD COLUMN "seatId" TEXT,
ADD COLUMN "ticketTypeName" TEXT,
ADD COLUMN "admissionType" "AdmissionType",
ADD COLUMN "sectionLabel" TEXT,
ADD COLUMN "rowLabel" TEXT,
ADD COLUMN "entranceLabel" TEXT,
ADD COLUMN "accessInstructions" TEXT,
ADD COLUMN "isTransferable" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "OrderItem"
ADD COLUMN "ticketTypeName" TEXT,
ADD COLUMN "admissionType" "AdmissionType",
ADD COLUMN "sectionLabel" TEXT,
ADD COLUMN "rowLabel" TEXT,
ADD COLUMN "entranceLabel" TEXT,
ADD COLUMN "accessInstructions" TEXT,
ADD COLUMN "isTransferable" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TicketSeat" (
    "id" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "label" TEXT NOT NULL,
    "sectionLabel" TEXT,
    "rowLabel" TEXT,
    "seatNumber" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "status" "TicketSeatStatus" NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketSeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Ticket_seatId_key" ON "Ticket"("seatId");
CREATE UNIQUE INDEX "TicketSeat_ticketTypeId_label_key" ON "TicketSeat"("ticketTypeId", "label");
CREATE INDEX "TicketSeat_ticketTypeId_status_sortOrder_idx" ON "TicketSeat"("ticketTypeId", "status", "sortOrder");
CREATE INDEX "TicketSeat_orderItemId_idx" ON "TicketSeat"("orderItemId");

ALTER TABLE "TicketType"
ADD CONSTRAINT "TicketType_seatStartNumber_positive"
CHECK ("seatStartNumber" IS NULL OR "seatStartNumber" > 0);

ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_seatId_fkey"
FOREIGN KEY ("seatId") REFERENCES "TicketSeat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TicketSeat"
ADD CONSTRAINT "TicketSeat_ticketTypeId_fkey"
FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TicketSeat"
ADD CONSTRAINT "TicketSeat_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TicketSeat" ENABLE ROW LEVEL SECURITY;
