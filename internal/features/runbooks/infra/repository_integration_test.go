package infra

import (
	"context"
	"testing"

	"github.com/traweezy/incindigo/internal/features/runbooks/domain"
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
}
