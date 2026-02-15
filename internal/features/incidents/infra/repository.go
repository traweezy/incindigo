package infra

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/traweezy/incindigo/internal/features/incidents/app"
	"github.com/traweezy/incindigo/internal/features/incidents/domain"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) UpsertFromWebhook(ctx context.Context, input app.WebhookInput) (domain.Incident, bool, error) {
	metadataBytes, err := json.Marshal(input.Metadata)
	if err != nil {
		return domain.Incident{}, false, fmt.Errorf("marshal metadata: %w", err)
	}

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return domain.Incident{}, false, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	incident, found, err := selectOpenByFingerprint(ctx, tx, input.Fingerprint)
	if err != nil {
		return domain.Incident{}, false, err
	}
	if found {
		err = updateIncidentFromWebhook(ctx, tx, incident.ID, input.Summary, input.Severity, metadataBytes)
		if err != nil {
			return domain.Incident{}, false, err
		}
		incident.Summary = input.Summary
		incident.Severity = input.Severity
		incident.Metadata = input.Metadata
		incident.UpdatedAt = time.Now().UTC()

		if err := tx.Commit(ctx); err != nil {
			return domain.Incident{}, false, fmt.Errorf("commit tx: %w", err)
		}
		return incident, false, nil
	}

	created, err := insertIncident(ctx, tx, input, metadataBytes)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
			incident, found, selectErr := selectOpenByFingerprint(ctx, tx, input.Fingerprint)
			if selectErr != nil {
				return domain.Incident{}, false, selectErr
			}
			if found {
				err = updateIncidentFromWebhook(ctx, tx, incident.ID, input.Summary, input.Severity, metadataBytes)
				if err != nil {
					return domain.Incident{}, false, err
				}
				incident.Summary = input.Summary
				incident.Severity = input.Severity
				incident.Metadata = input.Metadata
				incident.UpdatedAt = time.Now().UTC()
				if err := tx.Commit(ctx); err != nil {
					return domain.Incident{}, false, fmt.Errorf("commit tx: %w", err)
				}
				return incident, false, nil
			}
		}
		return domain.Incident{}, false, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Incident{}, false, fmt.Errorf("commit tx: %w", err)
	}

	return created, true, nil
}

func (r *Repository) List(ctx context.Context, limit int32) ([]domain.Incident, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, fingerprint, source, event_type, summary, severity, status, metadata, created_at, updated_at, resolved_at
		FROM incidents
		ORDER BY created_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("list incidents: %w", err)
	}
	defer rows.Close()

	incidents := make([]domain.Incident, 0)
	for rows.Next() {
		incident, err := scanIncident(rows)
		if err != nil {
			return nil, err
		}
		incidents = append(incidents, incident)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate incidents: %w", err)
	}

	return incidents, nil
}

func (r *Repository) Resolve(ctx context.Context, incidentID uuid.UUID) (domain.Incident, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE incidents
		SET status = 'resolved', resolved_at = now(), updated_at = now()
		WHERE id = $1 AND status = 'open'
		RETURNING id, fingerprint, source, event_type, summary, severity, status, metadata, created_at, updated_at, resolved_at`, incidentID)

	incident, err := scanIncidentRow(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Incident{}, app.ErrIncidentNotFound
		}
		return domain.Incident{}, err
	}
	return incident, nil
}

func (r *Repository) AutoResolveExpired(ctx context.Context, olderThan time.Time) ([]domain.Incident, error) {
	rows, err := r.pool.Query(ctx, `
		UPDATE incidents
		SET status = 'resolved', resolved_at = now(), updated_at = now()
		WHERE status = 'open' AND updated_at < $1
		RETURNING id, fingerprint, source, event_type, summary, severity, status, metadata, created_at, updated_at, resolved_at`, olderThan)
	if err != nil {
		return nil, fmt.Errorf("auto resolve incidents: %w", err)
	}
	defer rows.Close()

	resolved := make([]domain.Incident, 0)
	for rows.Next() {
		incident, err := scanIncident(rows)
		if err != nil {
			return nil, err
		}
		resolved = append(resolved, incident)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate auto resolved incidents: %w", err)
	}

	return resolved, nil
}

func (r *Repository) Overview(ctx context.Context) (app.Overview, error) {
	overview := app.Overview{
		GeneratedAt: time.Now().UTC(),
	}

	countsQuery := `
		SELECT
			COUNT(*)::bigint AS total,
			COUNT(*) FILTER (WHERE status = 'open')::bigint AS open,
			COUNT(*) FILTER (WHERE status = 'resolved')::bigint AS resolved,
			COUNT(*) FILTER (WHERE severity = 'critical')::bigint AS critical,
			COUNT(*) FILTER (WHERE severity = 'high')::bigint AS high,
			COUNT(*) FILTER (WHERE severity = 'medium')::bigint AS medium,
			COUNT(*) FILTER (WHERE severity = 'low')::bigint AS low,
			COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) FILTER (WHERE resolved_at IS NOT NULL), 0)::double precision AS avg_resolve_seconds,
			COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at <= created_at + interval '30 minutes')::bigint AS resolved_within_30m
		FROM incidents`

	err := r.pool.QueryRow(ctx, countsQuery).Scan(
		&overview.Counts.Total,
		&overview.Counts.Open,
		&overview.Counts.Resolved,
		&overview.Counts.Severity.Critical,
		&overview.Counts.Severity.High,
		&overview.Counts.Severity.Medium,
		&overview.Counts.Severity.Low,
		&overview.Resolution.AverageSeconds,
		&overview.Resolution.ResolvedWithin30m,
	)
	if err != nil {
		return app.Overview{}, fmt.Errorf("overview counts: %w", err)
	}

	topSources, err := r.querySourceAggregates(ctx)
	if err != nil {
		return app.Overview{}, err
	}
	overview.TopSources = topSources

	topEvents, err := r.queryEventAggregates(ctx)
	if err != nil {
		return app.Overview{}, err
	}
	overview.TopEventTypes = topEvents

	recentActivity, err := r.queryRecentActivity(ctx)
	if err != nil {
		return app.Overview{}, err
	}
	overview.RecentActivity = recentActivity

	return overview, nil
}

func selectOpenByFingerprint(ctx context.Context, tx pgx.Tx, fingerprint string) (domain.Incident, bool, error) {
	row := tx.QueryRow(ctx, `
		SELECT id, fingerprint, source, event_type, summary, severity, status, metadata, created_at, updated_at, resolved_at
		FROM incidents
		WHERE fingerprint = $1 AND status = 'open'
		LIMIT 1
		FOR UPDATE`, fingerprint)
	incident, err := scanIncidentRow(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Incident{}, false, nil
		}
		return domain.Incident{}, false, fmt.Errorf("select open incident: %w", err)
	}
	return incident, true, nil
}

func (r *Repository) querySourceAggregates(ctx context.Context) ([]app.SourceAggregate, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT source, COUNT(*)::bigint AS total, COUNT(*) FILTER (WHERE status = 'open')::bigint AS open
		FROM incidents
		GROUP BY source
		ORDER BY open DESC, total DESC, source ASC
		LIMIT 6`)
	if err != nil {
		return nil, fmt.Errorf("overview sources: %w", err)
	}
	defer rows.Close()

	sources := make([]app.SourceAggregate, 0)
	for rows.Next() {
		var item app.SourceAggregate
		if err := rows.Scan(&item.Source, &item.Total, &item.Open); err != nil {
			return nil, fmt.Errorf("scan source aggregate: %w", err)
		}
		sources = append(sources, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate source aggregates: %w", err)
	}

	return sources, nil
}

func (r *Repository) queryEventAggregates(ctx context.Context) ([]app.EventAggregate, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT event_type, COUNT(*)::bigint AS total, COUNT(*) FILTER (WHERE status = 'open')::bigint AS open
		FROM incidents
		GROUP BY event_type
		ORDER BY open DESC, total DESC, event_type ASC
		LIMIT 6`)
	if err != nil {
		return nil, fmt.Errorf("overview event types: %w", err)
	}
	defer rows.Close()

	events := make([]app.EventAggregate, 0)
	for rows.Next() {
		var item app.EventAggregate
		if err := rows.Scan(&item.EventType, &item.Total, &item.Open); err != nil {
			return nil, fmt.Errorf("scan event aggregate: %w", err)
		}
		events = append(events, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate event aggregates: %w", err)
	}

	return events, nil
}

func (r *Repository) queryRecentActivity(ctx context.Context) ([]app.ActivityAggregate, error) {
	rows, err := r.pool.Query(ctx, `
		WITH buckets AS (
			SELECT generate_series(
				date_trunc('minute', now() AT TIME ZONE 'UTC') - interval '5 hours 30 minutes',
				date_trunc('minute', now() AT TIME ZONE 'UTC'),
				interval '30 minutes'
			) AS bucket_start
		)
		SELECT
			(b.bucket_start AT TIME ZONE 'UTC')::timestamptz AS bucket_start,
			COALESCE((
				SELECT COUNT(*)::bigint
				FROM incidents created
				WHERE created.created_at >= b.bucket_start
					AND created.created_at < b.bucket_start + interval '30 minutes'
			), 0) AS created,
			COALESCE((
				SELECT COUNT(*)::bigint
				FROM incidents resolved
				WHERE resolved.resolved_at IS NOT NULL
					AND resolved.resolved_at >= b.bucket_start
					AND resolved.resolved_at < b.bucket_start + interval '30 minutes'
			), 0) AS resolved
		FROM buckets b
		ORDER BY b.bucket_start`)
	if err != nil {
		return nil, fmt.Errorf("overview activity: %w", err)
	}
	defer rows.Close()

	activity := make([]app.ActivityAggregate, 0)
	for rows.Next() {
		var item app.ActivityAggregate
		if err := rows.Scan(&item.BucketStart, &item.Created, &item.Resolved); err != nil {
			return nil, fmt.Errorf("scan activity aggregate: %w", err)
		}
		activity = append(activity, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate activity aggregates: %w", err)
	}

	return activity, nil
}

func updateIncidentFromWebhook(ctx context.Context, tx pgx.Tx, incidentID uuid.UUID, summary, severity string, metadata []byte) error {
	_, err := tx.Exec(ctx, `
		UPDATE incidents
		SET summary = $2, severity = $3, metadata = $4, updated_at = now()
		WHERE id = $1`, incidentID, summary, severity, metadata)
	if err != nil {
		return fmt.Errorf("update incident from webhook: %w", err)
	}
	return nil
}

func insertIncident(ctx context.Context, tx pgx.Tx, input app.WebhookInput, metadata []byte) (domain.Incident, error) {
	row := tx.QueryRow(ctx, `
		INSERT INTO incidents (id, fingerprint, source, event_type, summary, severity, status, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)
		RETURNING id, fingerprint, source, event_type, summary, severity, status, metadata, created_at, updated_at, resolved_at`,
		uuid.New(),
		input.Fingerprint,
		input.Source,
		input.EventType,
		input.Summary,
		input.Severity,
		metadata,
	)
	incident, err := scanIncidentRow(row)
	if err != nil {
		return domain.Incident{}, fmt.Errorf("insert incident: %w", err)
	}
	return incident, nil
}

func scanIncident(row pgx.CollectableRow) (domain.Incident, error) {
	return scanIncidentRow(row)
}

func scanIncidentRow(row interface {
	Scan(dest ...any) error
}) (domain.Incident, error) {
	var (
		incident     domain.Incident
		status       string
		metadataJSON []byte
	)

	err := row.Scan(
		&incident.ID,
		&incident.Fingerprint,
		&incident.Source,
		&incident.EventType,
		&incident.Summary,
		&incident.Severity,
		&status,
		&metadataJSON,
		&incident.CreatedAt,
		&incident.UpdatedAt,
		&incident.ResolvedAt,
	)
	if err != nil {
		return domain.Incident{}, err
	}

	incident.Status = domain.Status(status)
	if len(metadataJSON) == 0 {
		incident.Metadata = map[string]any{}
		return incident, nil
	}

	if err := json.Unmarshal(metadataJSON, &incident.Metadata); err != nil {
		return domain.Incident{}, fmt.Errorf("unmarshal metadata: %w", err)
	}

	if incident.Metadata == nil {
		incident.Metadata = map[string]any{}
	}

	return incident, nil
}
