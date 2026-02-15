package app

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/traweezy/incindigo/internal/features/incidents/domain"
	"github.com/traweezy/incindigo/internal/observability"
	"go.uber.org/zap"
)

type incidentsRepoMock struct {
	upsertFromWebhookFunc func(ctx context.Context, input WebhookInput) (domain.Incident, bool, error)
	listFunc              func(ctx context.Context, limit int32) ([]domain.Incident, error)
	resolveFunc           func(ctx context.Context, incidentID uuid.UUID) (domain.Incident, error)
	autoResolveFunc       func(ctx context.Context, olderThan time.Time) ([]domain.Incident, error)
	overviewFunc          func(ctx context.Context) (Overview, error)
}

func (m *incidentsRepoMock) UpsertFromWebhook(ctx context.Context, input WebhookInput) (domain.Incident, bool, error) {
	return m.upsertFromWebhookFunc(ctx, input)
}

func (m *incidentsRepoMock) List(ctx context.Context, limit int32) ([]domain.Incident, error) {
	return m.listFunc(ctx, limit)
}

func (m *incidentsRepoMock) Resolve(ctx context.Context, incidentID uuid.UUID) (domain.Incident, error) {
	return m.resolveFunc(ctx, incidentID)
}

func (m *incidentsRepoMock) AutoResolveExpired(ctx context.Context, olderThan time.Time) ([]domain.Incident, error) {
	return m.autoResolveFunc(ctx, olderThan)
}

func (m *incidentsRepoMock) Overview(ctx context.Context) (Overview, error) {
	if m.overviewFunc == nil {
		return Overview{}, nil
	}
	return m.overviewFunc(ctx)
}

type publisherMock struct {
	mu     sync.Mutex
	events []domain.TimelineEvent
}

func (p *publisherMock) Publish(event domain.TimelineEvent) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.events = append(p.events, event)
}

func (p *publisherMock) list() []domain.TimelineEvent {
	p.mu.Lock()
	defer p.mu.Unlock()
	cloned := make([]domain.TimelineEvent, len(p.events))
	copy(cloned, p.events)
	return cloned
}

func newIncidentServiceForTest(repo Repository, publisher Publisher) *Service {
	registry := prometheus.NewRegistry()
	metrics := observability.NewMetrics(registry)
	return NewService(repo, publisher, metrics, zap.NewNop())
}

func sampleIncident(status domain.Status) domain.Incident {
	return domain.Incident{
		ID:          uuid.New(),
		Fingerprint: "service-a:cpu",
		Source:      "test",
		EventType:   "cpu.high",
		Summary:     "CPU above threshold",
		Severity:    "high",
		Status:      status,
		Metadata:    map[string]any{"host": "api-1"},
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
}

func TestIngestWebhookPublishesCreatedEvent(t *testing.T) {
	repo := &incidentsRepoMock{
		upsertFromWebhookFunc: func(context.Context, WebhookInput) (domain.Incident, bool, error) {
			return sampleIncident(domain.StatusOpen), true, nil
		},
		listFunc:        func(context.Context, int32) ([]domain.Incident, error) { return nil, nil },
		resolveFunc:     func(context.Context, uuid.UUID) (domain.Incident, error) { return domain.Incident{}, nil },
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) { return nil, nil },
	}
	publisher := &publisherMock{}
	service := newIncidentServiceForTest(repo, publisher)

	incident, created, err := service.IngestWebhook(context.Background(), WebhookInput{Fingerprint: "service-a:cpu"})
	if err != nil {
		t.Fatalf("IngestWebhook returned error: %v", err)
	}
	if !created {
		t.Fatalf("expected created=true")
	}
	if incident.Status != domain.StatusOpen {
		t.Fatalf("expected open status")
	}

	events := publisher.list()
	if len(events) != 1 {
		t.Fatalf("expected 1 published event, got %d", len(events))
	}
	if events[0].EventType != "created" {
		t.Fatalf("expected created event, got %s", events[0].EventType)
	}
}

func TestIngestWebhookPublishesDeduplicatedEvent(t *testing.T) {
	repo := &incidentsRepoMock{
		upsertFromWebhookFunc: func(context.Context, WebhookInput) (domain.Incident, bool, error) {
			return sampleIncident(domain.StatusOpen), false, nil
		},
		listFunc:        func(context.Context, int32) ([]domain.Incident, error) { return nil, nil },
		resolveFunc:     func(context.Context, uuid.UUID) (domain.Incident, error) { return domain.Incident{}, nil },
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) { return nil, nil },
	}
	publisher := &publisherMock{}
	service := newIncidentServiceForTest(repo, publisher)

	_, created, err := service.IngestWebhook(context.Background(), WebhookInput{Fingerprint: "service-a:cpu"})
	if err != nil {
		t.Fatalf("IngestWebhook returned error: %v", err)
	}
	if created {
		t.Fatalf("expected created=false")
	}

	events := publisher.list()
	if len(events) != 1 {
		t.Fatalf("expected 1 published event, got %d", len(events))
	}
	if events[0].EventType != "deduplicated" {
		t.Fatalf("expected deduplicated event, got %s", events[0].EventType)
	}
}

func TestListIncidentsUsesDefaultLimitWhenNonPositive(t *testing.T) {
	var observedLimit int32
	repo := &incidentsRepoMock{
		upsertFromWebhookFunc: func(context.Context, WebhookInput) (domain.Incident, bool, error) {
			return domain.Incident{}, false, nil
		},
		listFunc: func(_ context.Context, limit int32) ([]domain.Incident, error) {
			observedLimit = limit
			return []domain.Incident{sampleIncident(domain.StatusOpen)}, nil
		},
		resolveFunc:     func(context.Context, uuid.UUID) (domain.Incident, error) { return domain.Incident{}, nil },
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) { return nil, nil },
	}

	service := newIncidentServiceForTest(repo, &publisherMock{})

	incidents, err := service.ListIncidents(context.Background(), 0)
	if err != nil {
		t.Fatalf("ListIncidents returned error: %v", err)
	}
	if len(incidents) != 1 {
		t.Fatalf("expected one incident")
	}
	if observedLimit != 100 {
		t.Fatalf("expected default limit 100, got %d", observedLimit)
	}
}

func TestResolveIncidentPublishesResolvedEvent(t *testing.T) {
	incident := sampleIncident(domain.StatusResolved)
	repo := &incidentsRepoMock{
		upsertFromWebhookFunc: func(context.Context, WebhookInput) (domain.Incident, bool, error) {
			return domain.Incident{}, false, nil
		},
		listFunc: func(context.Context, int32) ([]domain.Incident, error) {
			return nil, nil
		},
		resolveFunc: func(context.Context, uuid.UUID) (domain.Incident, error) {
			return incident, nil
		},
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) {
			return nil, nil
		},
	}
	publisher := &publisherMock{}
	service := newIncidentServiceForTest(repo, publisher)

	resolved, err := service.ResolveIncident(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("ResolveIncident returned error: %v", err)
	}
	if resolved.Status != domain.StatusResolved {
		t.Fatalf("expected resolved status")
	}

	events := publisher.list()
	if len(events) != 1 || events[0].EventType != "resolved" {
		t.Fatalf("expected one resolved event")
	}
}

func TestStartAutoResolveWorkerPublishesEvents(t *testing.T) {
	resolvedIncident := sampleIncident(domain.StatusResolved)
	publisher := &publisherMock{}

	called := make(chan struct{}, 1)
	repo := &incidentsRepoMock{
		upsertFromWebhookFunc: func(context.Context, WebhookInput) (domain.Incident, bool, error) {
			return domain.Incident{}, false, nil
		},
		listFunc:    func(context.Context, int32) ([]domain.Incident, error) { return nil, nil },
		resolveFunc: func(context.Context, uuid.UUID) (domain.Incident, error) { return domain.Incident{}, nil },
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) {
			select {
			case called <- struct{}{}:
			default:
			}
			return []domain.Incident{resolvedIncident}, nil
		},
	}

	service := newIncidentServiceForTest(repo, publisher)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go service.StartAutoResolveWorker(ctx, 5*time.Millisecond, time.Minute)

	select {
	case <-called:
	case <-time.After(300 * time.Millisecond):
		t.Fatalf("auto resolve worker did not call repository")
	}

	cancel()
	time.Sleep(20 * time.Millisecond)

	events := publisher.list()
	if len(events) == 0 {
		t.Fatalf("expected published auto_resolved events")
	}
	if events[0].EventType != "auto_resolved" {
		t.Fatalf("expected auto_resolved event, got %s", events[0].EventType)
	}
}

func TestResolveIncidentReturnsError(t *testing.T) {
	repo := &incidentsRepoMock{
		upsertFromWebhookFunc: func(context.Context, WebhookInput) (domain.Incident, bool, error) {
			return domain.Incident{}, false, nil
		},
		listFunc: func(context.Context, int32) ([]domain.Incident, error) {
			return nil, nil
		},
		resolveFunc: func(context.Context, uuid.UUID) (domain.Incident, error) {
			return domain.Incident{}, ErrIncidentNotFound
		},
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) {
			return nil, nil
		},
	}

	service := newIncidentServiceForTest(repo, &publisherMock{})
	_, err := service.ResolveIncident(context.Background(), uuid.New())
	if !errors.Is(err, ErrIncidentNotFound) {
		t.Fatalf("expected ErrIncidentNotFound, got %v", err)
	}
}

func TestOverviewDefaultsGeneratedAt(t *testing.T) {
	repo := &incidentsRepoMock{
		upsertFromWebhookFunc: func(context.Context, WebhookInput) (domain.Incident, bool, error) {
			return domain.Incident{}, false, nil
		},
		listFunc: func(context.Context, int32) ([]domain.Incident, error) {
			return nil, nil
		},
		resolveFunc: func(context.Context, uuid.UUID) (domain.Incident, error) {
			return domain.Incident{}, nil
		},
		autoResolveFunc: func(context.Context, time.Time) ([]domain.Incident, error) {
			return nil, nil
		},
		overviewFunc: func(context.Context) (Overview, error) {
			return Overview{}, nil
		},
	}

	service := newIncidentServiceForTest(repo, &publisherMock{})
	overview, err := service.Overview(context.Background())
	if err != nil {
		t.Fatalf("Overview returned error: %v", err)
	}
	if overview.GeneratedAt.IsZero() {
		t.Fatalf("expected non-zero generated_at")
	}
	if overview.TopSources == nil {
		t.Fatalf("expected top_sources to default to empty slice")
	}
	if overview.TopEventTypes == nil {
		t.Fatalf("expected top_event_types to default to empty slice")
	}
	if overview.RecentActivity == nil {
		t.Fatalf("expected recent_activity to default to empty slice")
	}
}
