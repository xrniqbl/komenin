-- Lead follow-up fields + indexes
-- Safe on DBs that already received leads/clients via db push.

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
