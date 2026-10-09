-- Backfill Workspace AI-default columns that were added to the Prisma schema
-- (commit 449c103) but never shipped as an incremental migration: databases
-- migrated through the regular chain lack them, so every workspace query
-- crashes with P2022 (column does not exist) and the client only sees
-- minified React error #441. IF NOT EXISTS keeps this safe on databases
-- created from the 0_init baseline (which already has these columns).

ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "aiDefaultProviderId" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "aiDefaultModel" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "aiFallbackModels" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "aiTemperature" DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "aiMaxTokens" INTEGER NOT NULL DEFAULT 280;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "agencyLabel" TEXT;
