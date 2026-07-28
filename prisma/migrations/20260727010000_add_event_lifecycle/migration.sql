ALTER TYPE "EventStatus" ADD VALUE 'cancelled';

ALTER TYPE "OrderStatus" ADD VALUE 'cancelled';
ALTER TYPE "OrderStatus" ADD VALUE 'refund_pending';
ALTER TYPE "OrderStatus" ADD VALUE 'refunded';

ALTER TABLE "Event"
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Event_clubId_archivedAt_startsAt_idx"
ON "Event"("clubId", "archivedAt", "startsAt");
