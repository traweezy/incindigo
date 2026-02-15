-- name: ListRunbooks :many
SELECT id, name, description, checklist, created_at, updated_at
FROM runbook_templates
ORDER BY created_at DESC;

-- name: InsertRunbook :one
INSERT INTO runbook_templates (id, name, description, checklist)
VALUES ($1, $2, $3, $4)
RETURNING id, name, description, checklist, created_at, updated_at;
