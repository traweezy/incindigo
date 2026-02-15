package app

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/traweezy/incindigo/internal/observability"
)

type Repository interface {
	InsertMagicLink(ctx context.Context, email, tokenHash string, expiresAt time.Time) error
	ConsumeMagicLink(ctx context.Context, tokenHash string) (string, bool, error)
}

type IssueResult struct {
	Email     string    `json:"email"`
	ExpiresAt time.Time `json:"expires_at"`
	Link      string    `json:"link"`
}

type Service struct {
	repo        Repository
	baseURL     string
	ttl         time.Duration
	metrics     *observability.Metrics
	timeNowFunc func() time.Time
}

func NewService(repo Repository, baseURL string, ttl time.Duration, metrics *observability.Metrics) *Service {
	return &Service{
		repo:        repo,
		baseURL:     strings.TrimRight(baseURL, "?"),
		ttl:         ttl,
		metrics:     metrics,
		timeNowFunc: func() time.Time { return time.Now().UTC() },
	}
}

func (s *Service) IssueMagicLink(ctx context.Context, email string) (IssueResult, error) {
	rawToken, err := newToken(32)
	if err != nil {
		return IssueResult{}, fmt.Errorf("generate token: %w", err)
	}

	tokenHash := hashToken(rawToken)
	expiresAt := s.timeNowFunc().Add(s.ttl)
	if err := s.repo.InsertMagicLink(ctx, strings.ToLower(strings.TrimSpace(email)), tokenHash, expiresAt); err != nil {
		return IssueResult{}, fmt.Errorf("insert magic link: %w", err)
	}

	s.metrics.MagicLinksIssued.Inc()
	separator := "?"
	if strings.Contains(s.baseURL, "?") {
		separator = "&"
	}

	return IssueResult{
		Email:     email,
		ExpiresAt: expiresAt,
		Link:      fmt.Sprintf("%s%stoken=%s", s.baseURL, separator, rawToken),
	}, nil
}

func (s *Service) VerifyMagicLink(ctx context.Context, token string) (string, bool, error) {
	email, ok, err := s.repo.ConsumeMagicLink(ctx, hashToken(token))
	if err != nil {
		s.metrics.MagicLinksChecked.WithLabelValues("error").Inc()
		return "", false, err
	}
	if !ok {
		s.metrics.MagicLinksChecked.WithLabelValues("invalid").Inc()
		return "", false, nil
	}

	s.metrics.MagicLinksChecked.WithLabelValues("verified").Inc()
	return email, true, nil
}

func hashToken(raw string) string {
	hash := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(hash[:])
}

func newToken(bytes int) (string, error) {
	buffer := make([]byte, bytes)
	_, err := rand.Read(buffer)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}
