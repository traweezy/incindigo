package app

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/traweezy/incindigo/internal/features/runbooks/domain"
)

type runbookRepoMock struct {
	listFunc            func(ctx context.Context) ([]domain.Template, error)
	listForIncidentFunc func(ctx context.Context, incidentID uuid.UUID) ([]domain.Template, error)
	createFunc          func(ctx context.Context, input domain.Template) (domain.Template, error)
	updateFunc          func(ctx context.Context, runbookID uuid.UUID, input domain.Template) (domain.Template, error)
	deleteFunc          func(ctx context.Context, runbookID uuid.UUID) error
}

func (m *runbookRepoMock) List(ctx context.Context) ([]domain.Template, error) {
	return m.listFunc(ctx)
}

func (m *runbookRepoMock) ListForIncident(ctx context.Context, incidentID uuid.UUID) ([]domain.Template, error) {
	return m.listForIncidentFunc(ctx, incidentID)
}

func (m *runbookRepoMock) Create(ctx context.Context, input domain.Template) (domain.Template, error) {
	return m.createFunc(ctx, input)
}

func (m *runbookRepoMock) Update(ctx context.Context, runbookID uuid.UUID, input domain.Template) (domain.Template, error) {
	return m.updateFunc(ctx, runbookID, input)
}

func (m *runbookRepoMock) Delete(ctx context.Context, runbookID uuid.UUID) error {
	return m.deleteFunc(ctx, runbookID)
}

func TestListReturnsRepositoryValues(t *testing.T) {
	repo := &runbookRepoMock{
		listFunc: func(context.Context) ([]domain.Template, error) {
			return []domain.Template{{ID: uuid.New(), Name: "cpu"}}, nil
		},
		listForIncidentFunc: func(context.Context, uuid.UUID) ([]domain.Template, error) { return nil, nil },
		createFunc: func(context.Context, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
		updateFunc: func(context.Context, uuid.UUID, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
		deleteFunc: func(context.Context, uuid.UUID) error { return nil },
	}
	service := NewService(repo)

	items, err := service.List(context.Background())
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 runbook")
	}
}

func TestCreatePropagatesError(t *testing.T) {
	repo := &runbookRepoMock{
		listFunc: func(context.Context) ([]domain.Template, error) { return nil, nil },
		listForIncidentFunc: func(context.Context, uuid.UUID) ([]domain.Template, error) { return nil, nil },
		createFunc: func(context.Context, domain.Template) (domain.Template, error) {
			return domain.Template{}, errors.New("insert failed")
		},
		updateFunc: func(context.Context, uuid.UUID, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
		deleteFunc: func(context.Context, uuid.UUID) error { return nil },
	}
	service := NewService(repo)

	_, err := service.Create(context.Background(), domain.Template{Name: "cpu"})
	if err == nil {
		t.Fatalf("expected create error")
	}
}

func TestUpdatePropagatesError(t *testing.T) {
	repo := &runbookRepoMock{
		listFunc:            func(context.Context) ([]domain.Template, error) { return nil, nil },
		listForIncidentFunc: func(context.Context, uuid.UUID) ([]domain.Template, error) { return nil, nil },
		createFunc: func(context.Context, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
		updateFunc: func(context.Context, uuid.UUID, domain.Template) (domain.Template, error) {
			return domain.Template{}, ErrRunbookNotFound
		},
		deleteFunc: func(context.Context, uuid.UUID) error { return nil },
	}
	service := NewService(repo)

	_, err := service.Update(context.Background(), uuid.New(), domain.Template{Name: "cpu"})
	if !errors.Is(err, ErrRunbookNotFound) {
		t.Fatalf("expected ErrRunbookNotFound, got %v", err)
	}
}
