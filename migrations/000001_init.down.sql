DROP TRIGGER IF EXISTS trg_runbook_templates_set_updated_at ON runbook_templates;
DROP TRIGGER IF EXISTS trg_incidents_set_updated_at ON incidents;
DROP FUNCTION IF EXISTS set_updated_at;

DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS magic_links;
DROP TABLE IF EXISTS runbook_templates;
DROP TABLE IF EXISTS incidents;
