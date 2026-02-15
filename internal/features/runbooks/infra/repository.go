package infra

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/traweezy/incindigo/internal/features/runbooks/domain"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) List(ctx context.Context) ([]domain.Template, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, description, checklist, created_at, updated_at
		FROM runbook_templates
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list runbooks: %w", err)
	}
	defer rows.Close()

	templates := make([]domain.Template, 0)
	for rows.Next() {
		template, err := scanTemplate(rows)
		if err != nil {
			return nil, err
		}
		templates = append(templates, template)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate runbooks: %w", err)
	}

	return templates, nil
}

func (r *Repository) Create(ctx context.Context, input domain.Template) (domain.Template, error) {
	checklistBytes, err := json.Marshal(input.Checklist)
	if err != nil {
		return domain.Template{}, fmt.Errorf("marshal checklist: %w", err)
	}

	row := r.pool.QueryRow(ctx, `
		INSERT INTO runbook_templates (id, name, description, checklist)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, description, checklist, created_at, updated_at`,
		uuid.New(),
		input.Name,
		input.Description,
		checklistBytes,
	)

	template, err := scanTemplateRow(row)
	if err != nil {
		return domain.Template{}, fmt.Errorf("insert runbook: %w", err)
	}
	return template, nil
}

func scanTemplate(row pgx.CollectableRow) (domain.Template, error) {
	return scanTemplateRow(row)
}

func scanTemplateRow(row interface{ Scan(dest ...any) error }) (domain.Template, error) {
	var (
		template      domain.Template
		checklistJSON []byte
	)

	if err := row.Scan(
		&template.ID,
		&template.Name,
		&template.Description,
		&checklistJSON,
		&template.CreatedAt,
		&template.UpdatedAt,
	); err != nil {
		return domain.Template{}, err
	}

	if err := json.Unmarshal(checklistJSON, &template.Checklist); err != nil {
		return domain.Template{}, fmt.Errorf("unmarshal checklist: %w", err)
	}

	if template.Checklist == nil {
		template.Checklist = []domain.ChecklistItem{}
	}

	return template, nil
}
