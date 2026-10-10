-- Short-lived holding slot for cookies pushed by the browser extension /
-- bookmarklet from instagram.com or threads.net. The wizard claims the row
-- once, encrypts the payload at rest, then deletes it — so a leaked claim id
-- can be replayed at most until expiry, and never after consumption.
CREATE TABLE "SessionIngest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "payloadEnc" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionIngest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SessionIngest_workspaceId_idx" ON "SessionIngest"("workspaceId");
CREATE INDEX "SessionIngest_expiresAt_idx" ON "SessionIngest"("expiresAt");

ALTER TABLE "SessionIngest"
  ADD CONSTRAINT "SessionIngest_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
