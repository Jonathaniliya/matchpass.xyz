-- AlterTable: allow Fan rows without a Supabase user (guest checkout)
ALTER TABLE "Fan" ALTER COLUMN "supabaseUserId" DROP NOT NULL;
