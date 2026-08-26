-- Optional public image URL so native Instagram/Threads container flow can publish.
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
