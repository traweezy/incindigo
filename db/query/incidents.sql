-- name: ListIncidents :many
SELECT id, fingerprint, source, event_type, summary, severity, status, metadata, created_at, updated_at, resolved_at
FROM incidents
ORDER BY created_at DESC
LIMIT $1;

-- name: ResolveIncident :one
UPDATE incidents
SET status = 'resolved', resolved_at = now(), updated_at = now()
WHERE id = $1
RETURNING id, fingerprint, source, event_type, summary, severity, status, metadata, created_at, updated_at, resolved_at;

-- name: AutoResolveExpired :many
UPDATE incidents
SET status = 'resolved', resolved_at = now(), updated_at = now()
WHERE status = 'open' AND updated_at < $1
RETURNING id, fingerprint, source, event_type, summary, severity, status, metadata, created_at, updated_at, resolved_at;
