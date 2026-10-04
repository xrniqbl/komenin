-- Weekly report marker: widen DigestMarker uniqueness to (workspaceId, dayKey, kind)
-- so the daily approval digest (kind=approval_digest, dayKey=YYYY-MM-DD) and the
-- Monday weekly report (kind=weekly_report, dayKey=YYYY-Www) coexist without
-- colliding. Backfills kind on legacy rows first so the new unique index builds.

UPDATE "DigestMarker" SET "kind" = 'approval_digest' WHERE "kind" IS NULL OR "kind" = '';

DROP INDEX IF EXISTS "DigestMarker_workspaceId_dayKey_key";

CREATE UNIQUE INDEX IF NOT EXISTS "DigestMarker_workspaceId_dayKey_kind_key"
    ON "DigestMarker"("workspaceId", "dayKey", "kind");
