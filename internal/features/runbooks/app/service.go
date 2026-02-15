package app

import (
	"context"

	"github.com/traweezy/incindigo/internal/features/runbooks/domain"
)

type Repository interface {
	List(ctx context.Context) ([]domain.Template, error)
	Create(ctx context.Context, input domain.Template) (domain.Template, error)
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

func (s *Service) Create(ctx context.Context, input domain.Template) (domain.Template, error) {
	return s.repo.Create(ctx, input)
}
