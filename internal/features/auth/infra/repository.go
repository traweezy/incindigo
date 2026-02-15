package infra

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) InsertMagicLink(ctx context.Context, email, tokenHash string, expiresAt time.Time) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO magic_links (id, email, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)
	`, uuid.New(), email, tokenHash, expiresAt)
	if err != nil {
		return fmt.Errorf("insert magic link: %w", err)
	}
	return nil
}

func (r *Repository) ConsumeMagicLink(ctx context.Context, tokenHash string) (string, bool, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE magic_links
		SET consumed_at = now()
		WHERE token_hash = $1
		  AND consumed_at IS NULL
		  AND expires_at > now()
		RETURNING email
	`, tokenHash)

	var email string
	if err := row.Scan(&email); err != nil {
		if err == pgx.ErrNoRows {
			return "", false, nil
		}
		return "", false, fmt.Errorf("consume magic link: %w", err)
	}

	return email, true, nil
}
