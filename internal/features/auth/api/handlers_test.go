package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	authapp "github.com/traweezy/incindigo/internal/features/auth/app"
	"github.com/traweezy/incindigo/internal/observability"
	"go.uber.org/zap"
)

type authRepoHandlerMock struct {
	insertFunc  func(ctx context.Context, email, tokenHash string, expiresAt time.Time) error
	consumeFunc func(ctx context.Context, tokenHash string) (string, bool, error)
}

func (m *authRepoHandlerMock) InsertMagicLink(ctx context.Context, email, tokenHash string, expiresAt time.Time) error {
	return m.insertFunc(ctx, email, tokenHash, expiresAt)
}

func (m *authRepoHandlerMock) ConsumeMagicLink(ctx context.Context, tokenHash string) (string, bool, error) {
	return m.consumeFunc(ctx, tokenHash)
}

func newAuthHandlerForTest(t *testing.T, repo *authRepoHandlerMock) *Handler {
	t.Helper()
	registry := prometheus.NewRegistry()
	metrics := observability.NewMetrics(registry)
	service := authapp.NewService(repo, "https://app.example.com/auth/verify", 20*time.Minute, metrics)
	return NewHandler(service, zap.NewNop())
}

func TestStartMagicLinkInvalidPayload(t *testing.T) {
	handler := newAuthHandlerForTest(t, &authRepoHandlerMock{
		insertFunc:  func(context.Context, string, string, time.Time) error { return nil },
		consumeFunc: func(context.Context, string) (string, bool, error) { return "", false, nil },
	})

	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/magic-link/start", bytes.NewBufferString("bad"))
	recorder := httptest.NewRecorder()
	handler.StartMagicLink(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
}

func TestStartMagicLinkSuccess(t *testing.T) {
	handler := newAuthHandlerForTest(t, &authRepoHandlerMock{
		insertFunc:  func(context.Context, string, string, time.Time) error { return nil },
		consumeFunc: func(context.Context, string) (string, bool, error) { return "", false, nil },
	})

	payload := []byte(`{"email":"user@example.com"}`)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/magic-link/start", bytes.NewReader(payload))
	recorder := httptest.NewRecorder()
	handler.StartMagicLink(recorder, request)

	if recorder.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", recorder.Code)
	}

	var response map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response["message"] == "" {
		t.Fatalf("expected message in response")
	}
}

func TestVerifyMagicLinkUnauthorized(t *testing.T) {
	handler := newAuthHandlerForTest(t, &authRepoHandlerMock{
		insertFunc: func(context.Context, string, string, time.Time) error { return nil },
		consumeFunc: func(context.Context, string) (string, bool, error) {
			return "", false, nil
		},
	})

	payload := []byte(`{"token":"12345678901234567890"}`)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/magic-link/verify", bytes.NewReader(payload))
	recorder := httptest.NewRecorder()
	handler.VerifyMagicLink(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func TestVerifyMagicLinkSuccess(t *testing.T) {
	handler := newAuthHandlerForTest(t, &authRepoHandlerMock{
		insertFunc: func(context.Context, string, string, time.Time) error { return nil },
		consumeFunc: func(context.Context, string) (string, bool, error) {
			return "user@example.com", true, nil
		},
	})

	payload := []byte(`{"token":"12345678901234567890"}`)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/magic-link/verify", bytes.NewReader(payload))
	recorder := httptest.NewRecorder()
	handler.VerifyMagicLink(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
}

func TestVerifyMagicLinkServiceError(t *testing.T) {
	handler := newAuthHandlerForTest(t, &authRepoHandlerMock{
		insertFunc: func(context.Context, string, string, time.Time) error { return nil },
		consumeFunc: func(context.Context, string) (string, bool, error) {
			return "", false, errors.New("db error")
		},
	})

	payload := []byte(`{"token":"12345678901234567890"}`)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/magic-link/verify", bytes.NewReader(payload))
	recorder := httptest.NewRecorder()
	handler.VerifyMagicLink(recorder, request)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", recorder.Code)
	}
}
