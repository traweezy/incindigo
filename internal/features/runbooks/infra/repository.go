package infra

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	runbooksapp "github.com/traweezy/incindigo/internal/features/runbooks/app"
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
		SELECT id, name, description, checklist, match_source, match_event_type, match_service, match_severity, match_fingerprint_contains, created_at, updated_at
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

func (r *Repository) ListForIncident(ctx context.Context, incidentID uuid.UUID) ([]domain.Template, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT r.id, r.name, r.description, r.checklist, r.match_source, r.match_event_type, r.match_service, r.match_severity, r.match_fingerprint_contains, r.created_at, r.updated_at
		FROM runbook_templates r
		JOIN incidents i ON i.id = $1
		WHERE
			(r.match_source IS NULL OR r.match_source = '' OR lower(r.match_source) = lower(i.source))
			AND (r.match_event_type IS NULL OR r.match_event_type = '' OR lower(r.match_event_type) = lower(i.event_type))
			AND (r.match_service IS NULL OR r.match_service = '' OR lower(r.match_service) = lower(COALESCE(i.metadata->>'service', '')))
			AND (r.match_severity IS NULL OR r.match_severity = '' OR lower(r.match_severity) = lower(i.severity))
			AND (
				r.match_fingerprint_contains IS NULL
				OR r.match_fingerprint_contains = ''
				OR position(lower(r.match_fingerprint_contains) in lower(i.fingerprint)) > 0
			)
		ORDER BY
			(
				CASE WHEN r.match_source IS NULL OR r.match_source = '' THEN 0 ELSE 1 END +
				CASE WHEN r.match_event_type IS NULL OR r.match_event_type = '' THEN 0 ELSE 1 END +
				CASE WHEN r.match_service IS NULL OR r.match_service = '' THEN 0 ELSE 1 END +
				CASE WHEN r.match_severity IS NULL OR r.match_severity = '' THEN 0 ELSE 1 END +
				CASE WHEN r.match_fingerprint_contains IS NULL OR r.match_fingerprint_contains = '' THEN 0 ELSE 1 END
			) DESC,
			r.created_at DESC`,
		incidentID,
	)
	if err != nil {
		return nil, fmt.Errorf("list runbooks for incident: %w", err)
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
		return nil, fmt.Errorf("iterate incident runbooks: %w", err)
	}

	return templates, nil
}

func (r *Repository) Create(ctx context.Context, input domain.Template) (domain.Template, error) {
	checklistBytes, err := json.Marshal(input.Checklist)
	if err != nil {
		return domain.Template{}, fmt.Errorf("marshal checklist: %w", err)
	}

	row := r.pool.QueryRow(ctx, `
		INSERT INTO runbook_templates (
			id, name, description, checklist, match_source, match_event_type, match_service, match_severity, match_fingerprint_contains
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, name, description, checklist, match_source, match_event_type, match_service, match_severity, match_fingerprint_contains, created_at, updated_at`,
		uuid.New(),
		strings.TrimSpace(input.Name),
		strings.TrimSpace(input.Description),
		checklistBytes,
		nullableText(input.Match.Source),
		nullableText(input.Match.EventType),
		nullableText(input.Match.Service),
		nullableText(input.Match.Severity),
		nullableText(input.Match.FingerprintContains),
	)

	template, err := scanTemplateRow(row)
	if err != nil {
		return domain.Template{}, fmt.Errorf("insert runbook: %w", err)
	}
	return template, nil
}

func (r *Repository) Update(ctx context.Context, runbookID uuid.UUID, input domain.Template) (domain.Template, error) {
	checklistBytes, err := json.Marshal(input.Checklist)
	if err != nil {
		return domain.Template{}, fmt.Errorf("marshal checklist: %w", err)
	}

	row := r.pool.QueryRow(ctx, `
		UPDATE runbook_templates
		SET
			name = $2,
			description = $3,
			checklist = $4,
			match_source = $5,
			match_event_type = $6,
			match_service = $7,
			match_severity = $8,
			match_fingerprint_contains = $9,
			updated_at = now()
		WHERE id = $1
		RETURNING id, name, description, checklist, match_source, match_event_type, match_service, match_severity, match_fingerprint_contains, created_at, updated_at`,
		runbookID,
		strings.TrimSpace(input.Name),
		strings.TrimSpace(input.Description),
		checklistBytes,
		nullableText(input.Match.Source),
		nullableText(input.Match.EventType),
		nullableText(input.Match.Service),
		nullableText(input.Match.Severity),
		nullableText(input.Match.FingerprintContains),
	)

	template, err := scanTemplateRow(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Template{}, runbooksapp.ErrRunbookNotFound
		}
		return domain.Template{}, fmt.Errorf("update runbook: %w", err)
	}
	return template, nil
}

func (r *Repository) Delete(ctx context.Context, runbookID uuid.UUID) error {
	commandTag, err := r.pool.Exec(ctx, `DELETE FROM runbook_templates WHERE id = $1`, runbookID)
	if err != nil {
		return fmt.Errorf("delete runbook: %w", err)
	}
	if commandTag.RowsAffected() == 0 {
		return runbooksapp.ErrRunbookNotFound
	}
	return nil
}

func scanTemplate(row pgx.CollectableRow) (domain.Template, error) {
	return scanTemplateRow(row)
}

func scanTemplateRow(row interface{ Scan(dest ...any) error }) (domain.Template, error) {
	var (
		template                  domain.Template
		checklistJSON             []byte
		matchSource               sql.NullString
		matchEventType            sql.NullString
		matchService              sql.NullString
		matchSeverity             sql.NullString
		matchFingerprintContains  sql.NullString
	)

	if err := row.Scan(
		&template.ID,
		&template.Name,
		&template.Description,
		&checklistJSON,
		&matchSource,
		&matchEventType,
		&matchService,
		&matchSeverity,
		&matchFingerprintContains,
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

	template.Match = domain.MatchRule{
		Source:              nullableString(matchSource),
		EventType:           nullableString(matchEventType),
		Service:             nullableString(matchService),
		Severity:            nullableString(matchSeverity),
		FingerprintContains: nullableString(matchFingerprintContains),
	}

	return template, nil
}

func nullableText(value string) any {
	normalized := strings.TrimSpace(strings.ToLower(value))
	if normalized == "" {
		return nil
	}
	return normalized
}

func nullableString(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	return strings.TrimSpace(value.String)
}
