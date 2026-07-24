-- Reconcile schema objects that were introduced with db push before they were
-- captured in migration history. Every statement is idempotent so this can be
-- deployed safely to both the existing Supabase project and a fresh database.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'Sport' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "Sport" AS ENUM ('football');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "League" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "sport" "Sport" NOT NULL DEFAULT 'football',
  "country" TEXT,
  "logoEmoji" TEXT,
  "logoUrl" TEXT,
  "tier" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "sport" "Sport" NOT NULL DEFAULT 'football';
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "logoEmoji" TEXT;
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "tier" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "leagueId" TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "logoEmoji" TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "sport" "Sport" NOT NULL DEFAULT 'football';
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Fan" ADD COLUMN IF NOT EXISTS "favoriteClubId" TEXT;
ALTER TABLE "Fan" ADD COLUMN IF NOT EXISTS "preferredCurrency" TEXT NOT NULL DEFAULT 'USDC';

CREATE UNIQUE INDEX IF NOT EXISTS "League_slug_key" ON "League"("slug");
CREATE INDEX IF NOT EXISTS "League_sport_tier_idx" ON "League"("sport", "tier");
CREATE INDEX IF NOT EXISTS "Club_leagueId_idx" ON "Club"("leagueId");
CREATE INDEX IF NOT EXISTS "Fan_favoriteClubId_idx" ON "Fan"("favoriteClubId");
CREATE UNIQUE INDEX IF NOT EXISTS "ClubCircleAccount_walletSetId_key" ON "ClubCircleAccount"("walletSetId");
CREATE UNIQUE INDEX IF NOT EXISTS "ClubCircleAccount_walletId_key" ON "ClubCircleAccount"("walletId");
CREATE UNIQUE INDEX IF NOT EXISTS "FanCircleWallet_walletId_key" ON "FanCircleWallet"("walletId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Club_leagueId_fkey'
      AND conrelid = '"Club"'::regclass
  ) THEN
    ALTER TABLE "Club"
      ADD CONSTRAINT "Club_leagueId_fkey"
      FOREIGN KEY ("leagueId") REFERENCES "League"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Fan_favoriteClubId_fkey'
      AND conrelid = '"Fan"'::regclass
  ) THEN
    ALTER TABLE "Fan"
      ADD CONSTRAINT "Fan_favoriteClubId_fkey"
      FOREIGN KEY ("favoriteClubId") REFERENCES "Club"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- This application uses Prisma for all product-data access. Keep the Supabase
-- Data API deny-by-default unless explicit ownership policies are added later.
ALTER TABLE "League" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Club" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClubCircleAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TicketType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Fan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FanCircleWallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FanFavoriteClub" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ticket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QrToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScanEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
