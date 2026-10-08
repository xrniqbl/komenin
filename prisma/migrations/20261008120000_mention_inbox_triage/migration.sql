-- Mentions & Inbox daily triage: assignee columns + multi-draft per mention.
--
--   Mention.assigneeId / TargetPost.assigneeId = operator owner (User.id),
--     nullable + SetNull so deleting a user never orphans triage rows.
--   CommentDraft.mentionId: drop the UNIQUE constraint so one mention can
--     hold several drafts (pipeline variants / saved-reply copies). The FK
--     itself is unchanged (SET NULL on mention delete).

-- Assignee columns (idempotent guards match repo migration style).
ALTER TABLE "Mention" ADD COLUMN IF NOT EXISTS "assigneeId" TEXT;
ALTER TABLE "TargetPost" ADD COLUMN IF NOT EXISTS "assigneeId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Mention_assigneeId_fkey'
  ) THEN
    ALTER TABLE "Mention" ADD CONSTRAINT "Mention_assigneeId_fkey"
      FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TargetPost_assigneeId_fkey'
  ) THEN
    ALTER TABLE "TargetPost" ADD CONSTRAINT "TargetPost_assigneeId_fkey"
      FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Mention_assigneeId_idx" ON "Mention"("assigneeId");
CREATE INDEX IF NOT EXISTS "TargetPost_assigneeId_idx" ON "TargetPost"("assigneeId");

-- Multi-draft: relax 1-draft-per-mention to many drafts per mention.
ALTER TABLE "CommentDraft" DROP CONSTRAINT IF EXISTS "CommentDraft_mentionId_key";
DROP INDEX IF EXISTS "CommentDraft_mentionId_key";
CREATE INDEX IF NOT EXISTS "CommentDraft_mentionId_createdAt_idx" ON "CommentDraft"("mentionId", "createdAt" DESC);
