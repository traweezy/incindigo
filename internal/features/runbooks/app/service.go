package app

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/traweezy/incindigo/internal/features/runbooks/domain"
)

var ErrRunbookNotFound = errors.New("runbook not found")

type Repository interface {
	List(ctx context.Context) ([]domain.Template, error)
	ListForIncident(ctx context.Context, incidentID uuid.UUID) ([]domain.Template, error)
	Create(ctx context.Context, input domain.Template) (domain.Template, error)
	Update(ctx context.Context, runbookID uuid.UUID, input domain.Template) (domain.Template, error)
	Delete(ctx context.Context, runbookID uuid.UUID) error
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context) ([]domain.Template, error) {
	return s.repo.List(ctx)
}

func (s *Service) ListForIncident(ctx context.Context, incidentID uuid.UUID) ([]domain.Template, error) {
	return s.repo.ListForIncident(ctx, incidentID)
}

func (s *Service) Create(ctx context.Context, input domain.Template) (domain.Template, error) {
	return s.repo.Create(ctx, input)
}

func (s *Service) Update(ctx context.Context, runbookID uuid.UUID, input domain.Template) (domain.Template, error) {
	return s.repo.Update(ctx, runbookID, input)
}

func (s *Service) Delete(ctx context.Context, runbookID uuid.UUID) error {
	return s.repo.Delete(ctx, runbookID)
}
