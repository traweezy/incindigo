package app

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/traweezy/incindigo/internal/observability"
)

type authRepoMock struct {
	insertFunc  func(ctx context.Context, email, tokenHash string, expiresAt time.Time) error
	consumeFunc func(ctx context.Context, tokenHash string) (string, bool, error)
}

func (m *authRepoMock) InsertMagicLink(ctx context.Context, email, tokenHash string, expiresAt time.Time) error {
	return m.insertFunc(ctx, email, tokenHash, expiresAt)
}

func (m *authRepoMock) ConsumeMagicLink(ctx context.Context, tokenHash string) (string, bool, error) {
	return m.consumeFunc(ctx, tokenHash)
}

func newAuthServiceForTest(repo Repository) *Service {
	registry := prometheus.NewRegistry()
	metrics := observability.NewMetrics(registry)
	return NewService(repo, "https://app.example.com/auth/verify", 20*time.Minute, metrics)
}

func TestIssueMagicLinkStoresNormalizedEmail(t *testing.T) {
	var observedEmail string
	var observedHash string
	var observedExpiry time.Time

	repo := &authRepoMock{
		insertFunc: func(_ context.Context, email, tokenHash string, expiresAt time.Time) error {
			observedEmail = email
			observedHash = tokenHash
			observedExpiry = expiresAt
			return nil
		},
		consumeFunc: func(context.Context, string) (string, bool, error) {
			return "", false, nil
		},
	}
	service := newAuthServiceForTest(repo)
	fixedNow := time.Date(2026, 2, 14, 19, 0, 0, 0, time.UTC)
	service.timeNowFunc = func() time.Time { return fixedNow }

	result, err := service.IssueMagicLink(context.Background(), "  USER@Example.COM  ")
	if err != nil {
		t.Fatalf("IssueMagicLink returned error: %v", err)
	}

	if observedEmail != "user@example.com" {
		t.Fatalf("expected normalized email, got %s", observedEmail)
	}
	if len(observedHash) != 64 {
		t.Fatalf("expected sha256 hash length 64, got %d", len(observedHash))
	}
	if observedExpiry != fixedNow.Add(20*time.Minute) {
		t.Fatalf("unexpected expiry %s", observedExpiry)
	}
	if !strings.Contains(result.Link, "token=") {
		t.Fatalf("expected token query parameter in link")
	}
}

func TestIssueMagicLinkPropagatesRepositoryError(t *testing.T) {
	repo := &authRepoMock{
		insertFunc: func(context.Context, string, string, time.Time) error {
			return errors.New("db write failed")
		},
		consumeFunc: func(context.Context, string) (string, bool, error) {
			return "", false, nil
		},
	}
	service := newAuthServiceForTest(repo)

	_, err := service.IssueMagicLink(context.Background(), "user@example.com")
	if err == nil || !strings.Contains(err.Error(), "insert magic link") {
		t.Fatalf("expected insert magic link error, got %v", err)
	}
}

func TestVerifyMagicLinkOutcomes(t *testing.T) {
	repo := &authRepoMock{
		insertFunc: func(context.Context, string, string, time.Time) error { return nil },
		consumeFunc: func(_ context.Context, tokenHash string) (string, bool, error) {
			switch tokenHash {
			case hashToken("good-token"):
				return "user@example.com", true, nil
			case hashToken("bad-token"):
				return "", false, nil
			default:
				return "", false, errors.New("lookup failed")
			}
		},
	}
	service := newAuthServiceForTest(repo)

	email, ok, err := service.VerifyMagicLink(context.Background(), "good-token")
	if err != nil || !ok || email != "user@example.com" {
		t.Fatalf("expected successful verification, got email=%s ok=%v err=%v", email, ok, err)
	}

	_, ok, err = service.VerifyMagicLink(context.Background(), "bad-token")
	if err != nil || ok {
		t.Fatalf("expected invalid token result, got ok=%v err=%v", ok, err)
	}

	_, ok, err = service.VerifyMagicLink(context.Background(), "unexpected-token")
	if err == nil || ok {
		t.Fatalf("expected error outcome, got ok=%v err=%v", ok, err)
	}
}
