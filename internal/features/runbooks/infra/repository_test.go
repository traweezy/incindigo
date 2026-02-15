package infra

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

type fakeTemplateRow struct {
	scanFn func(dest ...any) error
}

func (f fakeTemplateRow) Scan(dest ...any) error {
	return f.scanFn(dest...)
}

func TestScanTemplateRowParsesChecklist(t *testing.T) {
	t.Parallel()

	templateID := uuid.New()
	createdAt := time.Date(2026, 2, 14, 18, 30, 0, 0, time.UTC)
	updatedAt := createdAt.Add(time.Minute)

	row := fakeTemplateRow{
		scanFn: func(dest ...any) error {
			*(dest[0].(*uuid.UUID)) = templateID
			*(dest[1].(*string)) = "DB Failure Runbook"
			*(dest[2].(*string)) = "Steps for DB outages"
			*(dest[3].(*[]byte)) = []byte(`[{"id":"1","title":"Check replication lag","completed":false}]`)
			*(dest[4].(*time.Time)) = createdAt
			*(dest[5].(*time.Time)) = updatedAt
			return nil
		},
	}

	template, err := scanTemplateRow(row)
	if err != nil {
		t.Fatalf("scan template row: %v", err)
	}

	if template.ID != templateID {
		t.Fatalf("unexpected template id: %s", template.ID)
	}
	if len(template.Checklist) != 1 {
		t.Fatalf("expected 1 checklist item, got %d", len(template.Checklist))
	}
	if template.Checklist[0].Title != "Check replication lag" {
		t.Fatalf("unexpected checklist title: %q", template.Checklist[0].Title)
	}
}

func TestScanTemplateRowDefaultsNilChecklistToEmptySlice(t *testing.T) {
	t.Parallel()

	row := fakeTemplateRow{
		scanFn: func(dest ...any) error {
			*(dest[0].(*uuid.UUID)) = uuid.New()
			*(dest[1].(*string)) = "Template"
			*(dest[2].(*string)) = "Description"
			*(dest[3].(*[]byte)) = []byte("null")
			*(dest[4].(*time.Time)) = time.Now().UTC()
			*(dest[5].(*time.Time)) = time.Now().UTC()
			return nil
		},
	}

	template, err := scanTemplateRow(row)
	if err != nil {
		t.Fatalf("scan template row: %v", err)
	}
	if template.Checklist == nil {
		t.Fatalf("expected checklist slice, got nil")
	}
	if len(template.Checklist) != 0 {
		t.Fatalf("expected empty checklist, got %d", len(template.Checklist))
	}
}

func TestScanTemplateRowReturnsJSONError(t *testing.T) {
	t.Parallel()

	row := fakeTemplateRow{
		scanFn: func(dest ...any) error {
			*(dest[0].(*uuid.UUID)) = uuid.New()
			*(dest[1].(*string)) = "Template"
			*(dest[2].(*string)) = "Description"
			*(dest[3].(*[]byte)) = []byte(`[{"id":`)
			*(dest[4].(*time.Time)) = time.Now().UTC()
			*(dest[5].(*time.Time)) = time.Now().UTC()
			return nil
		},
	}

	_, err := scanTemplateRow(row)
	if err == nil {
		t.Fatalf("expected unmarshal checklist error")
	}
	if !strings.Contains(err.Error(), "unmarshal checklist") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestScanTemplateRowReturnsScanError(t *testing.T) {
	t.Parallel()

	row := fakeTemplateRow{
		scanFn: func(dest ...any) error {
			return errors.New("scan failed")
		},
	}

	_, err := scanTemplateRow(row)
	if err == nil {
		t.Fatalf("expected scan error")
	}
	if err.Error() != "scan failed" {
		t.Fatalf("unexpected error: %v", err)
	}
}
