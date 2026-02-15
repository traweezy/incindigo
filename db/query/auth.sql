-- name: InsertMagicLink :exec
INSERT INTO magic_links (id, email, token_hash, expires_at)
VALUES ($1, $2, $3, $4);

-- name: ConsumeMagicLink :one
UPDATE magic_links
SET consumed_at = now()
WHERE token_hash = $1
  AND consumed_at IS NULL
  AND expires_at > now()
RETURNING id, email, token_hash, expires_at, consumed_at, created_at;
