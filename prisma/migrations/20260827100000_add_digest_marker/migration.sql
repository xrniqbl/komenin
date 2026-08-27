-- Once-per-day digest email marker (approval digest etc.)
CREATE TABLE IF NOT EXISTS "DigestMarker" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'approval_digest',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigestMarker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DigestMarker_workspaceId_dayKey_key"
    ON "DigestMarker"("workspaceId", "dayKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigestMarker_workspaceId_dayKey_idx"
    ON "DigestMarker"("workspaceId", "dayKey");

-- AddForeignKey
ALTER TABLE "DigestMarker"
    ADD CONSTRAINT "DigestMarker_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
