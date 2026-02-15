package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

type pingerStub struct {
	err error
}

func (p pingerStub) Ping(context.Context) error {
	return p.err
}

func TestHealthHandler(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	recorder := httptest.NewRecorder()

	healthHandler(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if recorder.Body.String() != "{\"status\":\"ok\"}" {
		t.Fatalf("unexpected body: %s", recorder.Body.String())
	}
}

func TestReadinessHandlerReady(t *testing.T) {
	handler := readinessHandler(pingerStub{})
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	recorder := httptest.NewRecorder()

	handler(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if recorder.Body.String() != "{\"status\":\"ready\"}" {
		t.Fatalf("unexpected body: %s", recorder.Body.String())
	}
}

func TestReadinessHandlerNotReady(t *testing.T) {
	handler := readinessHandler(pingerStub{err: errors.New("db down")})
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	recorder := httptest.NewRecorder()

	handler(recorder, request)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", recorder.Code)
	}
	if recorder.Body.String() != "{\"status\":\"not_ready\"}" {
		t.Fatalf("unexpected body: %s", recorder.Body.String())
	}
}
