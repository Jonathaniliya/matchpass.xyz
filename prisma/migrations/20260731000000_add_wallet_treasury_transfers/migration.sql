-- Fan-initiated transfers and developer-controlled treasury sweeps are
-- internal server records. They are not exposed through the Supabase Data API.
CREATE TYPE "FanWalletTransferPurpose" AS ENUM ('withdrawal', 'order_payment');
CREATE TYPE "TreasurySweepStatus" AS ENUM ('pending', 'submitting', 'submitted', 'complete', 'failed', 'review');

CREATE TABLE "FanWalletTransfer" (
    "id" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "fanCircleWalletId" TEXT NOT NULL,
    "orderId" TEXT,
    "purpose" "FanWalletTransferPurpose" NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "amountUsdc" DECIMAL(18,6) NOT NULL,
    "tokenId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "challengeId" TEXT,
    "challengeStatus" TEXT NOT NULL DEFAULT 'created',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "challengeUpdatedAt" TIMESTAMP(3),
    CONSTRAINT "FanWalletTransfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreasurySweep" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "sourceWalletId" TEXT NOT NULL,
    "destinationWalletId" TEXT NOT NULL,
    "amountUsdc" DECIMAL(18,6) NOT NULL,
    "tokenId" TEXT,
    "sweptAmountUsdc" DECIMAL(18,6),
    "networkFeeUsdc" DECIMAL(18,6),
    "status" "TreasurySweepStatus" NOT NULL DEFAULT 'pending',
    "providerTransactionId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "TreasurySweep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FanWalletTransfer_idempotencyKey_key" ON "FanWalletTransfer"("idempotencyKey");
CREATE UNIQUE INDEX "FanWalletTransfer_challengeId_key" ON "FanWalletTransfer"("challengeId");
CREATE INDEX "FanWalletTransfer_fanId_createdAt_idx" ON "FanWalletTransfer"("fanId", "createdAt");
CREATE INDEX "FanWalletTransfer_orderId_idx" ON "FanWalletTransfer"("orderId");
CREATE INDEX "FanWalletTransfer_challengeStatus_createdAt_idx" ON "FanWalletTransfer"("challengeStatus", "createdAt");

CREATE UNIQUE INDEX "TreasurySweep_orderId_key" ON "TreasurySweep"("orderId");
CREATE UNIQUE INDEX "TreasurySweep_providerTransactionId_key" ON "TreasurySweep"("providerTransactionId");
CREATE INDEX "TreasurySweep_clubId_status_createdAt_idx" ON "TreasurySweep"("clubId", "status", "createdAt");
CREATE INDEX "TreasurySweep_sourceWalletId_status_idx" ON "TreasurySweep"("sourceWalletId", "status");

ALTER TABLE "FanWalletTransfer"
  ADD CONSTRAINT "FanWalletTransfer_fanId_fkey"
  FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FanWalletTransfer_fanCircleWalletId_fkey"
  FOREIGN KEY ("fanCircleWalletId") REFERENCES "FanCircleWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FanWalletTransfer_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TreasurySweep"
  ADD CONSTRAINT "TreasurySweep_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TreasurySweep_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FanWalletTransfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreasurySweep" ENABLE ROW LEVEL SECURITY;
