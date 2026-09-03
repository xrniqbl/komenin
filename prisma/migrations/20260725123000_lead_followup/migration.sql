-- Lead follow-up fields + indexes
-- Safe on DBs that already received leads/clients via db push.
--
-- Self-healing for fresh/shadow DBs: EngagementLead, LeadStatus and LeadSource
-- originally reached some databases via `db push` (no CREATE TYPE/TABLE in any
-- earlier migration), so a from-scratch replay failed here with P1014
-- ("underlying table for model EngagementLead does not exist"). Create the
-- enums and the table IF NOT EXISTS first; on existing DBs these are no-ops.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeadStatus') THEN
    CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'qualified', 'won', 'lost', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeadSource') THEN
    CREATE TYPE "LeadSource" AS ENUM ('inbox', 'approval', 'comment', 'manual', 'api');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "EngagementLead" (
    "id"           TEXT NOT NULL,
    "workspaceId"  TEXT NOT NULL,
    "clientId"     TEXT,
    "targetPostId" TEXT,
    "campaignId"   TEXT,
    "platform"     "Platform",
    "handle"       TEXT NOT NULL,
    "displayName"  TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "source"       "LeadSource" NOT NULL DEFAULT 'manual',
    "status"       "LeadStatus" NOT NULL DEFAULT 'new',
    "intent"       TEXT,
    "notes"        TEXT,
    "postSnippet"  TEXT,
    "draftSnippet" TEXT,
    "externalUrl"  TEXT,
    "ownerUserId"  TEXT,
    "followUpAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngagementLead_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EngagementLead" ADD COLUMN IF NOT EXISTS "followUpAt" TIMESTAMP(3);
ALTER TABLE "EngagementLead" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;

CREATE INDEX IF NOT EXISTS "EngagementLead_workspaceId_followUpAt_idx"
  ON "EngagementLead"("workspaceId", "followUpAt");

CREATE INDEX IF NOT EXISTS "EngagementLead_ownerUserId_idx"
  ON "EngagementLead"("ownerUserId");

-- Ensure preflight delivery kind exists (no-op if already present).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'DeliveryKind'
      AND e.enumlabel = 'send_comment_preflight'
  ) THEN
    ALTER TYPE "DeliveryKind" ADD VALUE 'send_comment_preflight';
  END IF;
END $$;
