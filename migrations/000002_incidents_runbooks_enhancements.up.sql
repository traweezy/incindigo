ALTER TABLE incidents
    ADD COLUMN reported_by TEXT NOT NULL DEFAULT 'system',
    ADD COLUMN cancelled_at TIMESTAMPTZ NULL,
    ADD COLUMN cancel_reason TEXT NULL,
    ADD COLUMN cancelled_by TEXT NULL;

ALTER TABLE incidents
    ADD CONSTRAINT incidents_status_check
    CHECK (status IN ('open', 'resolved', 'cancelled'));

ALTER TABLE runbook_templates
    ADD COLUMN match_source TEXT NULL,
    ADD COLUMN match_event_type TEXT NULL,
    ADD COLUMN match_service TEXT NULL,
    ADD COLUMN match_severity TEXT NULL,
    ADD COLUMN match_fingerprint_contains TEXT NULL;
