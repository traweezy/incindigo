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
	listFunc   func(ctx context.Context) ([]domain.Template, error)
	createFunc func(ctx context.Context, input domain.Template) (domain.Template, error)
}

func (m *runbookRepoHandlerMock) List(ctx context.Context) ([]domain.Template, error) {
	return m.listFunc(ctx)
}

func (m *runbookRepoHandlerMock) Create(ctx context.Context, input domain.Template) (domain.Template, error) {
	return m.createFunc(ctx, input)
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
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
}

func TestListRunbooksSuccess(t *testing.T) {
	handler := newRunbookHandlerForTest(&runbookRepoHandlerMock{
		listFunc: func(context.Context) ([]domain.Template, error) {
			return []domain.Template{sampleTemplate()}, nil
		},
		createFunc: func(context.Context, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
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
		createFunc: func(context.Context, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
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
		createFunc: func(context.Context, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
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
		createFunc: func(_ context.Context, input domain.Template) (domain.Template, error) {
			if len(input.Checklist) != 2 {
				t.Fatalf("expected checklist conversion")
			}
			return sampleTemplate(), nil
		},
	})

	payload := []byte(`{"name":"CPU","description":"Runbook","checklist":["step1","step2"]}`)
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
