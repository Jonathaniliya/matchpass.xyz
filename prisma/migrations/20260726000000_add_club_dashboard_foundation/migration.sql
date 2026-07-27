-- Club staff membership is the authorization source for the multi-tenant
-- dashboard. Invitations are bound to a verified Supabase email on first use.
CREATE TYPE "ClubMemberRole" AS ENUM ('owner', 'admin', 'box_office', 'gate');

CREATE TABLE "ClubMember" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "supabaseUserId" TEXT,
    "role" "ClubMemberRole" NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),

    CONSTRAINT "ClubMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubMember_clubId_email_key" ON "ClubMember"("clubId", "email");
CREATE UNIQUE INDEX "ClubMember_clubId_supabaseUserId_key" ON "ClubMember"("clubId", "supabaseUserId");
CREATE INDEX "ClubMember_supabaseUserId_idx" ON "ClubMember"("supabaseUserId");
CREATE INDEX "ClubMember_clubId_role_idx" ON "ClubMember"("clubId", "role");

ALTER TABLE "ClubMember"
ADD CONSTRAINT "ClubMember_clubId_fkey"
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Event" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "TicketType"
ADD COLUMN "description" TEXT,
ADD COLUMN "maxPerOrder" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "salesStartAt" TIMESTAMP(3),
ADD COLUMN "salesEndAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ClubMember" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "TicketType"
ADD CONSTRAINT "TicketType_quantityTotal_nonnegative" CHECK ("quantityTotal" >= 0),
ADD CONSTRAINT "TicketType_quantityReserved_nonnegative" CHECK ("quantityReserved" >= 0),
ADD CONSTRAINT "TicketType_quantitySold_nonnegative" CHECK ("quantitySold" >= 0),
ADD CONSTRAINT "TicketType_inventory_within_total" CHECK ("quantityReserved" + "quantitySold" <= "quantityTotal"),
ADD CONSTRAINT "TicketType_maxPerOrder_positive" CHECK ("maxPerOrder" > 0),
ADD CONSTRAINT "TicketType_sales_window_valid" CHECK ("salesEndAt" IS NULL OR "salesStartAt" IS NULL OR "salesEndAt" > "salesStartAt");
