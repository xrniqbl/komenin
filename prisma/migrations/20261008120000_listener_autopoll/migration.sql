-- Listener auto-poll scheduling: per-listener cadence + last-poll timestamp.
-- pollIntervalMinutes NULL = manual polling only (default, preserves existing
-- behavior). The `listener.autopoll` worker job polls active listeners whose
-- (lastPolledAt + interval) has passed; lastPolledAt is refreshed by every
-- poll path (manual pollListener, worker.tick runListenerPolls, autopoll).
ALTER TABLE "Listener" ADD COLUMN IF NOT EXISTS "pollIntervalMinutes" INTEGER;
ALTER TABLE "Listener" ADD COLUMN IF NOT EXISTS "lastPolledAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Listener_workspaceId_isActive_lastPolledAt_idx"
    ON "Listener"("workspaceId", "isActive", "lastPolledAt");
