-- Add session-based connector policies.
-- `prefer_session` / `session_only` route publishing through the imported
-- session cookie (unofficial private API) instead of webhook or OAuth.
-- Purely additive: no existing values are renamed or dropped.
ALTER TYPE "ConnectorPolicy" ADD VALUE IF NOT EXISTS 'prefer_session';
ALTER TYPE "ConnectorPolicy" ADD VALUE IF NOT EXISTS 'session_only';
