package infra

import (
	"context"
	"errors"
	"testing"
	"time"

	incidentsapp "github.com/traweezy/incindigo/internal/features/incidents/app"
	"github.com/traweezy/incindigo/internal/features/incidents/domain"
	"github.com/traweezy/incindigo/internal/testutil"
)

func TestRepositoryUpsertResolveAndListIntegration(t *testing.T) {
	pool := testutil.StartPostgres(t)
	repository := NewRepository(pool)
	ctx := context.Background()

	first, created, err := repository.UpsertFromWebhook(ctx, incidentsapp.WebhookInput{
		Fingerprint: "api-http-5xx",
		Source:      "manual-demo",
		EventType:   "http.5xx",
		Summary:     "Initial API failure",
		Severity:    "high",
		Metadata: map[string]any{
			"service": "api",
		},
	})
	if err != nil {
		t.Fatalf("create incident: %v", err)
	}
	if !created {
		t.Fatalf("expected created=true for first event")
	}
	if first.Status != domain.StatusOpen {
		t.Fatalf("expected open status, got %s", first.Status)
	}

	updated, created, err := repository.UpsertFromWebhook(ctx, incidentsapp.WebhookInput{
		Fingerprint: "api-http-5xx",
		Source:      "manual-demo",
		EventType:   "http.5xx",
		Summary:     "API failures persisted",
		Severity:    "critical",
		Metadata: map[string]any{
			"service": "edge",
		},
	})
	if err != nil {
		t.Fatalf("deduplicate incident: %v", err)
	}
	if created {
		t.Fatalf("expected created=false for duplicate fingerprint")
	}
	if updated.ID != first.ID {
		t.Fatalf("expected duplicate to update existing incident")
	}
	if updated.Summary != "API failures persisted" {
		t.Fatalf("expected updated summary, got %q", updated.Summary)
	}
	if updated.Severity != "critical" {
		t.Fatalf("expected updated severity, got %q", updated.Severity)
	}

	incidents, err := repository.List(ctx, 50)
	if err != nil {
		t.Fatalf("list incidents: %v", err)
	}
	if len(incidents) != 1 {
		t.Fatalf("expected one incident after deduplication, got %d", len(incidents))
	}

	resolved, err := repository.Resolve(ctx, first.ID)
	if err != nil {
		t.Fatalf("resolve incident: %v", err)
	}
	if resolved.Status != domain.StatusResolved {
		t.Fatalf("expected resolved status, got %s", resolved.Status)
	}
	if resolved.ResolvedAt == nil {
		t.Fatalf("expected resolved_at timestamp to be populated")
	}

	_, err = repository.Resolve(ctx, first.ID)
	if !errors.Is(err, incidentsapp.ErrIncidentNotFound) {
		t.Fatalf("expected ErrIncidentNotFound on second resolve, got %v", err)
	}
}

func TestRepositoryAutoResolveExpiredIntegration(t *testing.T) {
	pool := testutil.StartPostgres(t)
	repository := NewRepository(pool)
	ctx := context.Background()

	expiredIncident, _, err := repository.UpsertFromWebhook(ctx, incidentsapp.WebhookInput{
		Fingerprint: "expired-fingerprint",
		Source:      "manual-demo",
		EventType:   "db.latency",
		Summary:     "Old incident to auto resolve",
		Severity:    "medium",
		Metadata:    map[string]any{"service": "db"},
	})
	if err != nil {
		t.Fatalf("create expired incident: %v", err)
	}
	time.Sleep(25 * time.Millisecond)

	activeIncident, _, err := repository.UpsertFromWebhook(ctx, incidentsapp.WebhookInput{
		Fingerprint: "active-fingerprint",
		Source:      "manual-demo",
		EventType:   "cpu.high",
		Summary:     "Fresh incident to keep open",
		Severity:    "low",
		Metadata:    map[string]any{"service": "api"},
	})
	if err != nil {
		t.Fatalf("create active incident: %v", err)
	}

	threshold := activeIncident.UpdatedAt.Add(-time.Nanosecond)
	resolvedIncidents, err := repository.AutoResolveExpired(ctx, threshold)
	if err != nil {
		t.Fatalf("auto resolve incidents: %v", err)
	}
	if len(resolvedIncidents) != 1 {
		t.Fatalf("expected one incident to auto resolve, got %d", len(resolvedIncidents))
	}
	if resolvedIncidents[0].ID != expiredIncident.ID {
		t.Fatalf("unexpected incident auto-resolved: %s", resolvedIncidents[0].ID)
	}
	if resolvedIncidents[0].Status != domain.StatusResolved {
		t.Fatalf("expected auto-resolved status, got %s", resolvedIncidents[0].Status)
	}

	incidents, err := repository.List(ctx, 50)
	if err != nil {
		t.Fatalf("list incidents: %v", err)
	}

	foundActiveOpen := false
	for _, incident := range incidents {
		if incident.ID == activeIncident.ID && incident.Status == domain.StatusOpen {
			foundActiveOpen = true
			break
		}
	}
	if !foundActiveOpen {
		t.Fatalf("expected active incident to remain open")
	}
}

func TestRepositoryOverviewIntegration(t *testing.T) {
	pool := testutil.StartPostgres(t)
	repository := NewRepository(pool)
	ctx := context.Background()

	_, _, err := repository.UpsertFromWebhook(ctx, incidentsapp.WebhookInput{
		Fingerprint: "overview-open",
		Source:      "grafana",
		EventType:   "cpu.high",
		Summary:     "Open overview incident",
		Severity:    "critical",
		Metadata:    map[string]any{"service": "api"},
	})
	if err != nil {
		t.Fatalf("create open incident: %v", err)
	}

	resolvedIncident, _, err := repository.UpsertFromWebhook(ctx, incidentsapp.WebhookInput{
		Fingerprint: "overview-resolved",
		Source:      "pagerduty",
		EventType:   "db.latency",
		Summary:     "Resolved overview incident",
		Severity:    "high",
		Metadata:    map[string]any{"service": "worker"},
	})
	if err != nil {
		t.Fatalf("create resolved candidate: %v", err)
	}

	if _, err := repository.Resolve(ctx, resolvedIncident.ID); err != nil {
		t.Fatalf("resolve overview incident: %v", err)
	}

	overview, err := repository.Overview(ctx)
	if err != nil {
		t.Fatalf("overview query: %v", err)
	}

	if overview.Counts.Total < 2 {
		t.Fatalf("expected at least 2 incidents in overview, got %d", overview.Counts.Total)
	}
	if overview.Counts.Open < 1 {
		t.Fatalf("expected at least 1 open incident, got %d", overview.Counts.Open)
	}
	if overview.Counts.Resolved < 1 {
		t.Fatalf("expected at least 1 resolved incident, got %d", overview.Counts.Resolved)
	}
	if len(overview.TopSources) == 0 {
		t.Fatalf("expected top_sources data")
	}
	if len(overview.TopEventTypes) == 0 {
		t.Fatalf("expected top_event_types data")
	}
	if len(overview.RecentActivity) == 0 {
		t.Fatalf("expected recent_activity buckets")
	}
}
