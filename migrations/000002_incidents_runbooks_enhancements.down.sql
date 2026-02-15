ALTER TABLE runbook_templates
    DROP COLUMN IF EXISTS match_fingerprint_contains,
    DROP COLUMN IF EXISTS match_severity,
    DROP COLUMN IF EXISTS match_service,
    DROP COLUMN IF EXISTS match_event_type,
    DROP COLUMN IF EXISTS match_source;

ALTER TABLE incidents
    DROP CONSTRAINT IF EXISTS incidents_status_check;

ALTER TABLE incidents
    DROP COLUMN IF EXISTS cancelled_by,
    DROP COLUMN IF EXISTS cancel_reason,
    DROP COLUMN IF EXISTS cancelled_at,
    DROP COLUMN IF EXISTS reported_by;
