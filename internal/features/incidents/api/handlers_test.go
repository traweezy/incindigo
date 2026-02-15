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

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	incidentsapp "github.com/traweezy/incindigo/internal/features/incidents/app"
	"github.com/traweezy/incindigo/internal/features/incidents/domain"
	"github.com/traweezy/incindigo/internal/observability"
	"go.uber.org/zap"
)

type repoMock struct {
	upsertFromWebhookFunc func(ctx context.Context, input incidentsapp.WebhookInput) (domain.Incident, bool, error)
	listFunc              func(ctx context.Context, limit int32) ([]domain.Incident, error)
	resolveFunc           func(ctx context.Context, incidentID uuid.UUID) (domain.Incident, error)
	autoResolveFunc       func(ctx context.Context, olderThan time.Time) ([]domain.Incident, error)
	overviewFunc          func(ctx context.Context) (incidentsapp.Overview, error)
}

func (m *repoMock) UpsertFromWebhook(ctx context.Context, input incidentsapp.WebhookInput) (domain.Incident, bool, error) {
	return m.upsertFromWebhookFunc(ctx, input)
}

func (m *repoMock) List(ctx context.Context, limit int32) ([]domain.Incident, error) {
	return m.listFunc(ctx, limit)
}

func (m *repoMock) Resolve(ctx context.Context, incidentID uuid.UUID) (domain.Incident, error) {
	return m.resolveFunc(ctx, incidentID)
}

func (m *repoMock) AutoResolveExpired(ctx context.Context, olderThan time.Time) ([]domain.Incident, error) {
	return m.autoResolveFunc(ctx, olderThan)
}

func (m *repoMock) Overview(ctx context.Context) (incidentsapp.Overview, error) {
	if m.overviewFunc == nil {
		return incidentsapp.Overview{}, nil
	}
	return m.overviewFunc(ctx)
}

type publisherNoop struct{}

func (publisherNoop) Publish(domain.TimelineEvent) {}

func newHandlerForTest(t *testing.T, repo *repoMock) *Handler {
	t.Helper()

	registry := prometheus.NewRegistry()
	metrics := observability.NewMetrics(registry)
	service := incidentsapp.NewService(repo, publisherNoop{}, metrics, zap.NewNop())
	return NewHandler(service, zap.NewNop())
}

func testIncident() domain.Incident {
	return domain.Incident{
		ID:          uuid.New(),
		Fingerprint: "host-1:cpu",
		Source:      "test",
		EventType:   "cpu.high",
		Summary:     "CPU high",
		Severity:    "high",
		Status:      domain.StatusOpen,
		Metadata:    map[string]any{"host": "api-1"},
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
}

func TestPostWebhookBadPayload(t *testing.T) {
	handler := newHandlerForTest(t, &repoMock{
		upsertFromWebhookFunc: func(context.Context, incidentsapp.WebhookInput) (domain.Incident, bool, error) {
			return domain.Incident{}, false, nil
		},
		listFunc:        func(context.Context, int32) ([]domain.Incident, error) { return nil, nil },
		resolveFunc:     func(context.Context, uuid.UUID) (domain.Incident, error) { return domain.Incident{}, nil },
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) { return nil, nil },
	})

	request := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/events", bytes.NewBufferString("{bad json"))
	recorder := httptest.NewRecorder()
	handler.PostWebhook(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", recorder.Code)
	}
}

func TestPostWebhookSuccess(t *testing.T) {
	incident := testIncident()
	handler := newHandlerForTest(t, &repoMock{
		upsertFromWebhookFunc: func(context.Context, incidentsapp.WebhookInput) (domain.Incident, bool, error) {
			return incident, true, nil
		},
		listFunc:        func(context.Context, int32) ([]domain.Incident, error) { return nil, nil },
		resolveFunc:     func(context.Context, uuid.UUID) (domain.Incident, error) { return domain.Incident{}, nil },
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) { return nil, nil },
	})

	payload := map[string]any{
		"fingerprint": "host-1:cpu",
		"source":      "test",
		"event_type":  "cpu.high",
		"summary":     "CPU high",
		"severity":    "high",
		"metadata":    map[string]any{"host": "api-1"},
	}
	bytesPayload, _ := json.Marshal(payload)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/events", bytes.NewReader(bytesPayload))
	recorder := httptest.NewRecorder()

	handler.PostWebhook(recorder, request)

	if recorder.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d", recorder.Code)
	}

	var response map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if _, ok := response["incident"]; !ok {
		t.Fatalf("expected incident in response")
	}
}

func TestListIncidents(t *testing.T) {
	incident := testIncident()
	observedLimit := int32(0)
	handler := newHandlerForTest(t, &repoMock{
		upsertFromWebhookFunc: func(context.Context, incidentsapp.WebhookInput) (domain.Incident, bool, error) {
			return domain.Incident{}, false, nil
		},
		listFunc: func(_ context.Context, limit int32) ([]domain.Incident, error) {
			observedLimit = limit
			return []domain.Incident{incident}, nil
		},
		resolveFunc:     func(context.Context, uuid.UUID) (domain.Incident, error) { return domain.Incident{}, nil },
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) { return nil, nil },
	})

	request := httptest.NewRequest(http.MethodGet, "/api/v1/incidents?limit=12", nil)
	recorder := httptest.NewRecorder()
	handler.ListIncidents(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	if observedLimit != 12 {
		t.Fatalf("expected limit 12, got %d", observedLimit)
	}
}

func TestResolveIncidentInvalidID(t *testing.T) {
	handler := newHandlerForTest(t, &repoMock{
		upsertFromWebhookFunc: func(context.Context, incidentsapp.WebhookInput) (domain.Incident, bool, error) {
			return domain.Incident{}, false, nil
		},
		listFunc:        func(context.Context, int32) ([]domain.Incident, error) { return nil, nil },
		resolveFunc:     func(context.Context, uuid.UUID) (domain.Incident, error) { return domain.Incident{}, nil },
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) { return nil, nil },
	})

	request := httptest.NewRequest(http.MethodPost, "/api/v1/incidents/not-a-uuid/resolve", nil)
	recorder := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/incidents/{id}/resolve", handler.ResolveIncident)
	mux.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", recorder.Code)
	}
}

func TestResolveIncidentNotFound(t *testing.T) {
	handler := newHandlerForTest(t, &repoMock{
		upsertFromWebhookFunc: func(context.Context, incidentsapp.WebhookInput) (domain.Incident, bool, error) {
			return domain.Incident{}, false, nil
		},
		listFunc: func(context.Context, int32) ([]domain.Incident, error) {
			return nil, nil
		},
		resolveFunc: func(context.Context, uuid.UUID) (domain.Incident, error) {
			return domain.Incident{}, incidentsapp.ErrIncidentNotFound
		},
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) {
			return nil, nil
		},
	})

	incidentID := uuid.New()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/incidents/"+incidentID.String()+"/resolve", nil)
	recorder := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/incidents/{id}/resolve", handler.ResolveIncident)
	mux.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", recorder.Code)
	}
}

func TestResolveIncidentSuccess(t *testing.T) {
	incident := testIncident()
	handler := newHandlerForTest(t, &repoMock{
		upsertFromWebhookFunc: func(context.Context, incidentsapp.WebhookInput) (domain.Incident, bool, error) {
			return domain.Incident{}, false, nil
		},
		listFunc: func(context.Context, int32) ([]domain.Incident, error) {
			return nil, nil
		},
		resolveFunc: func(context.Context, uuid.UUID) (domain.Incident, error) {
			return incident, nil
		},
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) {
			return nil, nil
		},
	})

	incidentID := uuid.New()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/incidents/"+incidentID.String()+"/resolve", nil)
	recorder := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/incidents/{id}/resolve", handler.ResolveIncident)
	mux.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var response map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if _, ok := response["incident"]; !ok {
		t.Fatalf("expected incident payload")
	}
}

func TestListIncidentsHandlesServiceError(t *testing.T) {
	handler := newHandlerForTest(t, &repoMock{
		upsertFromWebhookFunc: func(context.Context, incidentsapp.WebhookInput) (domain.Incident, bool, error) {
			return domain.Incident{}, false, nil
		},
		listFunc: func(context.Context, int32) ([]domain.Incident, error) {
			return nil, errors.New("db unavailable")
		},
		resolveFunc:     func(context.Context, uuid.UUID) (domain.Incident, error) { return domain.Incident{}, nil },
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) { return nil, nil },
	})

	request := httptest.NewRequest(http.MethodGet, "/api/v1/incidents", nil)
	recorder := httptest.NewRecorder()
	handler.ListIncidents(recorder, request)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", recorder.Code)
	}
}

func TestOverviewSuccess(t *testing.T) {
	handler := newHandlerForTest(t, &repoMock{
		upsertFromWebhookFunc: func(context.Context, incidentsapp.WebhookInput) (domain.Incident, bool, error) {
			return domain.Incident{}, false, nil
		},
		listFunc:        func(context.Context, int32) ([]domain.Incident, error) { return nil, nil },
		resolveFunc:     func(context.Context, uuid.UUID) (domain.Incident, error) { return domain.Incident{}, nil },
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) { return nil, nil },
		overviewFunc: func(context.Context) (incidentsapp.Overview, error) {
			return incidentsapp.Overview{
				GeneratedAt: time.Now().UTC(),
				Counts: incidentsapp.OverviewCounts{
					Total:    12,
					Open:     7,
					Resolved: 5,
				},
			}, nil
		},
	})

	request := httptest.NewRequest(http.MethodGet, "/api/v1/incidents/overview", nil)
	recorder := httptest.NewRecorder()
	handler.Overview(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var response map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if _, ok := response["overview"]; !ok {
		t.Fatalf("expected overview payload")
	}
}

func TestOverviewHandlesServiceError(t *testing.T) {
	handler := newHandlerForTest(t, &repoMock{
		upsertFromWebhookFunc: func(context.Context, incidentsapp.WebhookInput) (domain.Incident, bool, error) {
			return domain.Incident{}, false, nil
		},
		listFunc:        func(context.Context, int32) ([]domain.Incident, error) { return nil, nil },
		resolveFunc:     func(context.Context, uuid.UUID) (domain.Incident, error) { return domain.Incident{}, nil },
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) { return nil, nil },
		overviewFunc: func(context.Context) (incidentsapp.Overview, error) {
			return incidentsapp.Overview{}, errors.New("overview down")
		},
	})

	request := httptest.NewRequest(http.MethodGet, "/api/v1/incidents/overview", nil)
	recorder := httptest.NewRecorder()
	handler.Overview(recorder, request)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", recorder.Code)
	}
}
