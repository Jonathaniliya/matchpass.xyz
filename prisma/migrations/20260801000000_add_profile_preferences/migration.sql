ALTER TABLE "Fan"
  ADD COLUMN "avatarUrl" TEXT,
  ADD COLUMN "themePreference" TEXT NOT NULL DEFAULT 'system';

ALTER TABLE "Fan"
  ADD CONSTRAINT "Fan_themePreference_check"
  CHECK ("themePreference" IN ('system', 'light', 'dark'));
