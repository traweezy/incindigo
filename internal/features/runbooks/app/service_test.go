package app

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/traweezy/incindigo/internal/features/runbooks/domain"
)

type runbookRepoMock struct {
	listFunc   func(ctx context.Context) ([]domain.Template, error)
	createFunc func(ctx context.Context, input domain.Template) (domain.Template, error)
}

func (m *runbookRepoMock) List(ctx context.Context) ([]domain.Template, error) {
	return m.listFunc(ctx)
}

func (m *runbookRepoMock) Create(ctx context.Context, input domain.Template) (domain.Template, error) {
	return m.createFunc(ctx, input)
}

func TestListReturnsRepositoryValues(t *testing.T) {
	repo := &runbookRepoMock{
		listFunc: func(context.Context) ([]domain.Template, error) {
			return []domain.Template{{ID: uuid.New(), Name: "cpu"}}, nil
		},
		createFunc: func(context.Context, domain.Template) (domain.Template, error) {
			return domain.Template{}, nil
		},
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
		createFunc: func(context.Context, domain.Template) (domain.Template, error) {
			return domain.Template{}, errors.New("insert failed")
		},
	}
	service := NewService(repo)

	_, err := service.Create(context.Background(), domain.Template{Name: "cpu"})
	if err == nil {
		t.Fatalf("expected create error")
	}
}
