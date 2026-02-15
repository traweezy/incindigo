package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/traweezy/incindigo/internal/features/incidents/domain"
	"github.com/traweezy/incindigo/internal/observability"
	"go.uber.org/zap"
)

var ErrIncidentNotFound = errors.New("incident not found")

type WebhookInput struct {
	Fingerprint string
	Source      string
	EventType   string
	Summary     string
	Severity    string
	ReportedBy  string
	Metadata    map[string]any
}

type Repository interface {
	UpsertFromWebhook(ctx context.Context, input WebhookInput) (domain.Incident, bool, error)
	List(ctx context.Context, limit int32) ([]domain.Incident, error)
	Resolve(ctx context.Context, incidentID uuid.UUID) (domain.Incident, error)
	Cancel(ctx context.Context, incidentID uuid.UUID, reason, cancelledBy string) (domain.Incident, error)
	AutoResolveExpired(ctx context.Context, olderThan time.Time) ([]domain.Incident, error)
	Overview(ctx context.Context) (Overview, error)
}

type Publisher interface {
	Publish(event domain.TimelineEvent)
}

type Service struct {
	repo      Repository
	publisher Publisher
	metrics   *observability.Metrics
	logger    *zap.Logger
}

type Overview struct {
	GeneratedAt    time.Time           `json:"generated_at"`
	Counts         OverviewCounts      `json:"counts"`
	Resolution     ResolutionMetrics   `json:"resolution"`
	TopSources     []SourceAggregate   `json:"top_sources"`
	TopEventTypes  []EventAggregate    `json:"top_event_types"`
	RecentActivity []ActivityAggregate `json:"recent_activity"`
}

type OverviewCounts struct {
	Total    int64          `json:"total"`
	Open     int64          `json:"open"`
	Resolved int64          `json:"resolved"`
	Cancelled int64         `json:"cancelled"`
	Severity SeverityCounts `json:"severity"`
}

type SeverityCounts struct {
	Critical int64 `json:"critical"`
	High     int64 `json:"high"`
	Medium   int64 `json:"medium"`
	Low      int64 `json:"low"`
}

type ResolutionMetrics struct {
	AverageSeconds    float64 `json:"average_seconds"`
	ResolvedWithin30m int64   `json:"resolved_within_30m"`
}

type SourceAggregate struct {
	Source string `json:"source"`
	Total  int64  `json:"total"`
	Open   int64  `json:"open"`
}

type EventAggregate struct {
	EventType string `json:"event_type"`
	Total     int64  `json:"total"`
	Open      int64  `json:"open"`
}

type ActivityAggregate struct {
	BucketStart time.Time `json:"bucket_start"`
	Created     int64     `json:"created"`
	Resolved    int64     `json:"resolved"`
}

func NewService(repo Repository, publisher Publisher, metrics *observability.Metrics, logger *zap.Logger) *Service {
	return &Service{
		repo:      repo,
		publisher: publisher,
		metrics:   metrics,
		logger:    logger,
	}
}

func (s *Service) IngestWebhook(ctx context.Context, input WebhookInput) (domain.Incident, bool, error) {
	incident, created, err := s.repo.UpsertFromWebhook(ctx, input)
	if err != nil {
		return domain.Incident{}, false, err
	}

	eventType := "deduplicated"
	if created {
		eventType = "created"
	}

	s.metrics.IncidentEvents.WithLabelValues(eventType).Inc()
	s.publisher.Publish(domain.TimelineEvent{
		EventType:  eventType,
		Incident:   incident,
		OccurredAt: time.Now().UTC(),
	})

	return incident, created, nil
}

func (s *Service) ListIncidents(ctx context.Context, limit int32) ([]domain.Incident, error) {
	if limit <= 0 {
		limit = 100
	}
	return s.repo.List(ctx, limit)
}

func (s *Service) ResolveIncident(ctx context.Context, incidentID uuid.UUID) (domain.Incident, error) {
	incident, err := s.repo.Resolve(ctx, incidentID)
	if err != nil {
		return domain.Incident{}, err
	}

	s.metrics.IncidentEvents.WithLabelValues("resolved").Inc()
	s.publisher.Publish(domain.TimelineEvent{
		EventType:  "resolved",
		Incident:   incident,
		OccurredAt: time.Now().UTC(),
	})

	return incident, nil
}

func (s *Service) CancelIncident(ctx context.Context, incidentID uuid.UUID, reason, cancelledBy string) (domain.Incident, error) {
	incident, err := s.repo.Cancel(ctx, incidentID, reason, cancelledBy)
	if err != nil {
		return domain.Incident{}, err
	}

	s.metrics.IncidentEvents.WithLabelValues("cancelled").Inc()
	s.publisher.Publish(domain.TimelineEvent{
		EventType:  "cancelled",
		Incident:   incident,
		OccurredAt: time.Now().UTC(),
	})

	return incident, nil
}

func (s *Service) Overview(ctx context.Context) (Overview, error) {
	overview, err := s.repo.Overview(ctx)
	if err != nil {
		return Overview{}, err
	}

	if overview.GeneratedAt.IsZero() {
		overview.GeneratedAt = time.Now().UTC()
	}

	if overview.TopSources == nil {
		overview.TopSources = []SourceAggregate{}
	}
	if overview.TopEventTypes == nil {
		overview.TopEventTypes = []EventAggregate{}
	}
	if overview.RecentActivity == nil {
		overview.RecentActivity = []ActivityAggregate{}
	}

	return overview, nil
}

func (s *Service) StartAutoResolveWorker(ctx context.Context, tickEvery, resolveAfter time.Duration) {
	ticker := time.NewTicker(tickEvery)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			threshold := time.Now().UTC().Add(-resolveAfter)
			incidents, err := s.repo.AutoResolveExpired(ctx, threshold)
			if err != nil {
				s.logger.Error("auto resolve failed", zap.Error(err))
				continue
			}

			for _, incident := range incidents {
				s.metrics.IncidentEvents.WithLabelValues("auto_resolved").Inc()
				s.publisher.Publish(domain.TimelineEvent{
					EventType:  "auto_resolved",
					Incident:   incident,
					OccurredAt: time.Now().UTC(),
				})
			}
		}
	}
}
