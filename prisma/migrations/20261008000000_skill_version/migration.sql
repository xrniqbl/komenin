-- Skill versioning: track edit generations so operators can tell which
-- config revision produced a given run. Existing rows start at 1 via the
-- column default; updateSkill increments on every edit.

ALTER TABLE "Skill" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
