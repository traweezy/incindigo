package infra

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	runbooksapp "github.com/traweezy/incindigo/internal/features/runbooks/app"
	"github.com/traweezy/incindigo/internal/features/runbooks/domain"
	incidentsapp "github.com/traweezy/incindigo/internal/features/incidents/app"
	incidentsinfra "github.com/traweezy/incindigo/internal/features/incidents/infra"
	"github.com/traweezy/incindigo/internal/testutil"
)

func TestRepositoryCreateAndListRunbooksIntegration(t *testing.T) {
	pool := testutil.StartPostgres(t)
	repository := NewRepository(pool)
	ctx := context.Background()

	created, err := repository.Create(ctx, domain.Template{
		Name:        "Database Degradation",
		Description: "Checklist for elevated DB latency",
		Checklist: []domain.ChecklistItem{
			{
				ID:        "item-1",
				Title:     "Check primary connection saturation",
				Completed: false,
			},
			{
				ID:        "item-2",
				Title:     "Validate replication lag",
				Completed: false,
			},
		},
		Match: domain.MatchRule{
			Source:    "grafana",
			EventType: "db.latency",
			Service:   "api",
			Severity:  "high",
		},
	})
	if err != nil {
		t.Fatalf("create runbook: %v", err)
	}
	if created.ID.String() == "" {
		t.Fatalf("expected created runbook id")
	}
	if len(created.Checklist) != 2 {
		t.Fatalf("expected two checklist items, got %d", len(created.Checklist))
	}
	if created.Match.EventType != "db.latency" {
		t.Fatalf("expected match event type to persist, got %q", created.Match.EventType)
	}

	items, err := repository.List(ctx)
	if err != nil {
		t.Fatalf("list runbooks: %v", err)
	}
	if len(items) == 0 {
		t.Fatalf("expected at least one runbook")
	}
	if items[0].Name != "Database Degradation" {
		t.Fatalf("unexpected first runbook name: %q", items[0].Name)
	}

	updated, err := repository.Update(ctx, created.ID, domain.Template{
		Name:        "Database Degradation v2",
		Description: "Updated checklist",
		Checklist: []domain.ChecklistItem{
			{
				ID:        "item-1",
				Title:     "Collect pg_stat_activity snapshots",
				Completed: false,
			},
		},
		Match: domain.MatchRule{
			Source:    "manual-demo",
			EventType: "db.latency",
			Service:   "worker",
			Severity:  "critical",
		},
	})
	if err != nil {
		t.Fatalf("update runbook: %v", err)
	}
	if updated.Name != "Database Degradation v2" {
		t.Fatalf("expected updated name, got %q", updated.Name)
	}
	if updated.Match.Service != "worker" {
		t.Fatalf("expected updated match service, got %q", updated.Match.Service)
	}

	incidentRepo := incidentsinfra.NewRepository(pool)
	incident, _, err := incidentRepo.UpsertFromWebhook(ctx, incidentsapp.WebhookInput{
		Fingerprint: "worker-db-latency",
		Source:      "manual-demo",
		EventType:   "db.latency",
		Summary:     "Worker db latency high",
		Severity:    "critical",
		ReportedBy:  "integration-test",
		Metadata: map[string]any{
			"service": "worker",
		},
	})
	if err != nil {
		t.Fatalf("create incident for runbook matching: %v", err)
	}

	matched, err := repository.ListForIncident(ctx, incident.ID)
	if err != nil {
		t.Fatalf("list runbooks for incident: %v", err)
	}
	if len(matched) == 0 {
		t.Fatalf("expected matched runbook for incident")
	}
	if matched[0].ID != created.ID {
		t.Fatalf("expected updated runbook to match incident")
	}

	if err := repository.Delete(ctx, created.ID); err != nil {
		t.Fatalf("delete runbook: %v", err)
	}
	if err := repository.Delete(ctx, created.ID); !errors.Is(err, runbooksapp.ErrRunbookNotFound) {
		t.Fatalf("expected ErrRunbookNotFound on second delete, got %v", err)
	}

	_, err = repository.Update(ctx, uuid.New(), domain.Template{
		Name:        "missing",
		Description: "missing",
		Checklist: []domain.ChecklistItem{{
			ID:        "item-1",
			Title:     "none",
			Completed: false,
		}},
	})
	if !errors.Is(err, runbooksapp.ErrRunbookNotFound) {
		t.Fatalf("expected ErrRunbookNotFound on update missing, got %v", err)
	}
}
