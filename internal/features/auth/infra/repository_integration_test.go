package infra

import (
	"context"
	"testing"
	"time"

	"github.com/traweezy/incindigo/internal/testutil"
)

func TestRepositoryInsertAndConsumeMagicLinkIntegration(t *testing.T) {
	pool := testutil.StartPostgres(t)
	repository := NewRepository(pool)
	ctx := context.Background()

	email := "demo@example.com"
	tokenHash := "token-hash-123"
	expiresAt := time.Now().UTC().Add(10 * time.Minute)

	if err := repository.InsertMagicLink(ctx, email, tokenHash, expiresAt); err != nil {
		t.Fatalf("insert magic link: %v", err)
	}

	consumedEmail, ok, err := repository.ConsumeMagicLink(ctx, tokenHash)
	if err != nil {
		t.Fatalf("consume magic link: %v", err)
	}
	if !ok {
		t.Fatalf("expected magic link to be consumable")
	}
	if consumedEmail != email {
		t.Fatalf("expected email %q, got %q", email, consumedEmail)
	}

	_, ok, err = repository.ConsumeMagicLink(ctx, tokenHash)
	if err != nil {
		t.Fatalf("consume already-used magic link: %v", err)
	}
	if ok {
		t.Fatalf("expected second consume to fail")
	}
}

func TestRepositoryDoesNotConsumeExpiredMagicLinkIntegration(t *testing.T) {
	pool := testutil.StartPostgres(t)
	repository := NewRepository(pool)
	ctx := context.Background()

	if err := repository.InsertMagicLink(ctx, "expired@example.com", "expired-token", time.Now().UTC().Add(-time.Minute)); err != nil {
		t.Fatalf("insert expired magic link: %v", err)
	}

	_, ok, err := repository.ConsumeMagicLink(ctx, "expired-token")
	if err != nil {
		t.Fatalf("consume expired magic link: %v", err)
	}
	if ok {
		t.Fatalf("expected expired magic link to be rejected")
	}
}
