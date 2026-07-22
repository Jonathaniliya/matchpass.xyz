-- AlterTable
ALTER TABLE "Club" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Fan" ADD COLUMN "preferredCurrency" TEXT NOT NULL DEFAULT 'USDC';

-- CreateTable
CREATE TABLE "FanFavoriteClub" (
    "fanId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FanFavoriteClub_pkey" PRIMARY KEY ("fanId", "clubId")
);

-- CreateIndex
CREATE INDEX "FanFavoriteClub_fanId_idx" ON "FanFavoriteClub"("fanId");

-- AddForeignKey
ALTER TABLE "FanFavoriteClub" ADD CONSTRAINT "FanFavoriteClub_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanFavoriteClub" ADD CONSTRAINT "FanFavoriteClub_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
