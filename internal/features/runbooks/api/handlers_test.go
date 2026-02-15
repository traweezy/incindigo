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
	runbooksapp "github.com/traweezy/incindigo/internal/features/runbooks/app"
	"github.com/traweezy/incindigo/internal/features/runbooks/domain"
	"go.uber.org/zap"
)

type runbookRepoHandlerMock struct {
	listFunc            func(ctx context.Context) ([]domain.Template, error)
	listForIncidentFunc func(ctx context.Context, incidentID uuid.UUID) ([]domain.Template, error)
	createFunc          func(ctx context.Context, input domain.Template) (domain.Template, error)
	updateFunc          func(ctx context.Context, runbookID uuid.UUID, input domain.Template) (domain.Template, error)
	deleteFunc          func(ctx context.Context, runbookID uuid.UUID) error
}

func (m *runbookRepoHandlerMock) List(ctx context.Context) ([]domain.Template, error) {
	return m.listFunc(ctx)
}

func (m *runbookRepoHandlerMock) ListForIncident(ctx context.Context, incidentID uuid.UUID) ([]domain.Template, error) {
	return m.listForIncidentFunc(ctx, incidentID)
}

func (m *runbookRepoHandlerMock) Create(ctx context.Context, input domain.Template) (domain.Template, error) {
	return m.createFunc(ctx, input)
}

func (m *runbookRepoHandlerMock) Update(ctx context.Context, runbookID uuid.UUID, input domain.Template) (domain.Template, error) {
	return m.updateFunc(ctx, runbookID, input)
}

func (m *runbookRepoHandlerMock) Delete(ctx context.Context, runbookID uuid.UUID) error {
	return m.deleteFunc(ctx, runbookID)
}

func newRunbookHandlerForTest(repo *runbookRepoHandlerMock) *Handler {
	service := runbooksapp.NewService(repo)
	return NewHandler(service, zap.NewNop())
}

func sampleTemplate() domain.Template {
	return domain.Template{
		ID:          uuid.New(),
		Name:        "CPU Runbook",
		Description: "Handle CPU incidents",
		Checklist: []domain.ChecklistItem{{
			ID:        "item-1",
			Title:     "Scale workload",
			Completed: false,
		}},
		Match: domain.MatchRule{
			Source:    "pagerduty",
			EventType: "cpu.high",
			Service:   "api",
			Severity:  "high",
		},
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
}

func TestListRunbooksSuccess(t *testing.T) {
	handler := newRunbookHandlerForTest(&runbookRepoHandlerMock{
		listFunc: func(context.Context) ([]domain.Template, error) {
			return []domain.Template{sampleTemplate()}, nil
		},
		listForIncidentFunc: func(context.Context, uuid.UUID) ([]domain.Template, error) {
			return nil, nil
		},
		createFunc: func(context.Context, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
		updateFunc: func(context.Context, uuid.UUID, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
		deleteFunc: func(context.Context, uuid.UUID) error { return nil },
	})

	request := httptest.NewRequest(http.MethodGet, "/api/v1/runbooks", nil)
	recorder := httptest.NewRecorder()
	handler.ListRunbooks(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
}

func TestListRunbooksError(t *testing.T) {
	handler := newRunbookHandlerForTest(&runbookRepoHandlerMock{
		listFunc: func(context.Context) ([]domain.Template, error) {
			return nil, errors.New("db down")
		},
		listForIncidentFunc: func(context.Context, uuid.UUID) ([]domain.Template, error) {
			return nil, nil
		},
		createFunc: func(context.Context, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
		updateFunc: func(context.Context, uuid.UUID, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
		deleteFunc: func(context.Context, uuid.UUID) error { return nil },
	})

	request := httptest.NewRequest(http.MethodGet, "/api/v1/runbooks", nil)
	recorder := httptest.NewRecorder()
	handler.ListRunbooks(recorder, request)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", recorder.Code)
	}
}

func TestCreateRunbookBadPayload(t *testing.T) {
	handler := newRunbookHandlerForTest(&runbookRepoHandlerMock{
		listFunc: func(context.Context) ([]domain.Template, error) { return nil, nil },
		listForIncidentFunc: func(context.Context, uuid.UUID) ([]domain.Template, error) {
			return nil, nil
		},
		createFunc: func(context.Context, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
		updateFunc: func(context.Context, uuid.UUID, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
		deleteFunc: func(context.Context, uuid.UUID) error { return nil },
	})

	request := httptest.NewRequest(http.MethodPost, "/api/v1/runbooks", bytes.NewBufferString("bad"))
	recorder := httptest.NewRecorder()
	handler.CreateRunbook(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
}

func TestCreateRunbookSuccess(t *testing.T) {
	handler := newRunbookHandlerForTest(&runbookRepoHandlerMock{
		listFunc: func(context.Context) ([]domain.Template, error) { return nil, nil },
		listForIncidentFunc: func(context.Context, uuid.UUID) ([]domain.Template, error) {
			return nil, nil
		},
		createFunc: func(_ context.Context, input domain.Template) (domain.Template, error) {
			if len(input.Checklist) != 2 {
				t.Fatalf("expected checklist conversion")
			}
			if input.Match.Source != "pagerduty" || input.Match.EventType != "cpu.high" {
				t.Fatalf("expected match conversion")
			}
			return sampleTemplate(), nil
		},
		updateFunc: func(context.Context, uuid.UUID, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
		deleteFunc: func(context.Context, uuid.UUID) error { return nil },
	})

	payload := []byte(`{
		"name":"CPU",
		"description":"Runbook",
		"checklist":["step1","step2"],
		"match":{"source":"PagerDuty","event_type":"CPU.High","service":"API","severity":"high"}
	}`)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/runbooks", bytes.NewReader(payload))
	recorder := httptest.NewRecorder()
	handler.CreateRunbook(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", recorder.Code)
	}

	var response map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if _, ok := response["runbook"]; !ok {
		t.Fatalf("expected runbook in response")
	}
}

func TestListRunbooksForIncidentSuccess(t *testing.T) {
	handler := newRunbookHandlerForTest(&runbookRepoHandlerMock{
		listFunc: func(context.Context) ([]domain.Template, error) { return nil, nil },
		listForIncidentFunc: func(context.Context, uuid.UUID) ([]domain.Template, error) {
			return []domain.Template{sampleTemplate()}, nil
		},
		createFunc: func(context.Context, domain.Template) (domain.Template, error) { return domain.Template{}, nil },
		updateFunc: func(context.Context, uuid.UUID, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
		deleteFunc: func(context.Context, uuid.UUID) error { return nil },
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/incidents/"+uuid.NewString()+"/runbooks", nil)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/incidents/{id}/runbooks", handler.ListRunbooksForIncident)
	mux.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
}

func TestUpdateRunbookNotFound(t *testing.T) {
	handler := newRunbookHandlerForTest(&runbookRepoHandlerMock{
		listFunc:            func(context.Context) ([]domain.Template, error) { return nil, nil },
		listForIncidentFunc: func(context.Context, uuid.UUID) ([]domain.Template, error) { return nil, nil },
		createFunc:          func(context.Context, domain.Template) (domain.Template, error) { return domain.Template{}, nil },
		updateFunc: func(context.Context, uuid.UUID, domain.Template) (domain.Template, error) {
			return domain.Template{}, runbooksapp.ErrRunbookNotFound
		},
		deleteFunc: func(context.Context, uuid.UUID) error { return nil },
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/api/v1/runbooks/"+uuid.NewString(), bytes.NewBufferString(`{
		"name":"CPU",
		"description":"Runbook",
		"checklist":["step1"]
	}`))

	mux := http.NewServeMux()
	mux.HandleFunc("PUT /api/v1/runbooks/{id}", handler.UpdateRunbook)
	mux.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
}

func TestDeleteRunbookSuccess(t *testing.T) {
	handler := newRunbookHandlerForTest(&runbookRepoHandlerMock{
		listFunc:            func(context.Context) ([]domain.Template, error) { return nil, nil },
		listForIncidentFunc: func(context.Context, uuid.UUID) ([]domain.Template, error) { return nil, nil },
		createFunc:          func(context.Context, domain.Template) (domain.Template, error) { return domain.Template{}, nil },
		updateFunc: func(context.Context, uuid.UUID, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
		deleteFunc: func(context.Context, uuid.UUID) error { return nil },
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/api/v1/runbooks/"+uuid.NewString(), nil)

	mux := http.NewServeMux()
	mux.HandleFunc("DELETE /api/v1/runbooks/{id}", handler.DeleteRunbook)
	mux.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", recorder.Code)
	}
}
