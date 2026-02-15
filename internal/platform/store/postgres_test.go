package store

import (
	"context"
	"strings"
	"testing"
)

func TestNewPoolRequiresDatabaseURL(t *testing.T) {
	t.Parallel()

	_, err := NewPool(context.Background(), "")
	if err == nil {
		t.Fatalf("expected error for empty database URL")
	}
	if !strings.Contains(err.Error(), "INCINDIGO_DATABASE_URL is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestNewPoolRejectsInvalidDatabaseURL(t *testing.T) {
	t.Parallel()

	_, err := NewPool(context.Background(), "postgres://%zz")
	if err == nil {
		t.Fatalf("expected parse error")
	}
	if !strings.Contains(err.Error(), "parse database config") {
		t.Fatalf("unexpected error: %v", err)
	}
}
