package problem

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWrite(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/incidents", nil)
	recorder := httptest.NewRecorder()

	Write(
		recorder,
		req,
		http.StatusBadRequest,
		"Validation failed",
		"payload is invalid",
		[]FieldError{
			{
				Field:   "summary",
				Message: "summary is required",
			},
		},
	)

	response := recorder.Result()
	defer response.Body.Close()

	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.StatusCode)
	}

	contentType := response.Header.Get("Content-Type")
	if contentType != "application/problem+json" {
		t.Fatalf("expected content type application/problem+json, got %q", contentType)
	}

	var payload Problem
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatalf("decode problem payload: %v", err)
	}

	if payload.Type != "about:blank" {
		t.Fatalf("expected type about:blank, got %q", payload.Type)
	}
	if payload.Title != "Validation failed" {
		t.Fatalf("unexpected title: %q", payload.Title)
	}
	if payload.Detail != "payload is invalid" {
		t.Fatalf("unexpected detail: %q", payload.Detail)
	}
	if payload.Instance != "/api/v1/incidents" {
		t.Fatalf("unexpected instance: %q", payload.Instance)
	}
	if len(payload.Errors) != 1 {
		t.Fatalf("expected 1 field error, got %d", len(payload.Errors))
	}
	if payload.Errors[0].Field != "summary" {
		t.Fatalf("unexpected field error field: %q", payload.Errors[0].Field)
	}
}
