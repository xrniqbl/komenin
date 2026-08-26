-- Workspace-level quiet hours in workspace local time ([start, end); equal = off).
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "quietHoursStart" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "quietHoursEnd" INTEGER NOT NULL DEFAULT 0;
