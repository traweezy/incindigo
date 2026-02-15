package infra

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/traweezy/incindigo/internal/features/incidents/domain"
)

type fakeIncidentRow struct {
	scanFn func(dest ...any) error
}

func (f fakeIncidentRow) Scan(dest ...any) error {
	return f.scanFn(dest...)
}

func TestScanIncidentRowParsesMetadata(t *testing.T) {
	t.Parallel()

	incidentID := uuid.New()
	createdAt := time.Date(2026, 2, 14, 18, 0, 0, 0, time.UTC)
	updatedAt := createdAt.Add(time.Minute)
	resolvedAt := updatedAt.Add(time.Minute)

	row := fakeIncidentRow{
		scanFn: func(dest ...any) error {
			*(dest[0].(*uuid.UUID)) = incidentID
			*(dest[1].(*string)) = "service:disk"
			*(dest[2].(*string)) = "synthetic"
			*(dest[3].(*string)) = "disk.warning"
			*(dest[4].(*string)) = "Disk pressure warning"
			*(dest[5].(*string)) = "high"
			*(dest[6].(*string)) = "reporter@example.com"
			*(dest[7].(*string)) = string(domain.StatusResolved)
			*(dest[8].(*[]byte)) = []byte(`{"service":"api","attempts":3}`)
			*(dest[9].(*time.Time)) = createdAt
			*(dest[10].(*time.Time)) = updatedAt
			*(dest[11].(**time.Time)) = &resolvedAt
			*(dest[12].(**time.Time)) = nil
			*(dest[13].(**string)) = nil
			*(dest[14].(**string)) = nil
			return nil
		},
	}

	incident, err := scanIncidentRow(row)
	if err != nil {
		t.Fatalf("scan incident row: %v", err)
	}

	if incident.ID != incidentID {
		t.Fatalf("unexpected incident id: %s", incident.ID)
	}
	if incident.Status != domain.StatusResolved {
		t.Fatalf("unexpected status: %s", incident.Status)
	}
	if incident.Metadata["service"] != "api" {
		t.Fatalf("expected metadata service to be api, got %#v", incident.Metadata["service"])
	}
	if incident.Metadata["attempts"] != float64(3) {
		t.Fatalf("expected metadata attempts=3, got %#v", incident.Metadata["attempts"])
	}
	if incident.ResolvedAt == nil || !incident.ResolvedAt.Equal(resolvedAt) {
		t.Fatalf("unexpected resolved_at: %#v", incident.ResolvedAt)
	}
}

func TestScanIncidentRowDefaultsEmptyMetadataMap(t *testing.T) {
	t.Parallel()

	createdAt := time.Now().UTC()
	updatedAt := createdAt

	row := fakeIncidentRow{
		scanFn: func(dest ...any) error {
			*(dest[0].(*uuid.UUID)) = uuid.New()
			*(dest[1].(*string)) = "fp"
			*(dest[2].(*string)) = "source"
			*(dest[3].(*string)) = "event"
			*(dest[4].(*string)) = "summary"
			*(dest[5].(*string)) = "low"
			*(dest[6].(*string)) = "reporter@example.com"
			*(dest[7].(*string)) = string(domain.StatusOpen)
			*(dest[8].(*[]byte)) = []byte{}
			*(dest[9].(*time.Time)) = createdAt
			*(dest[10].(*time.Time)) = updatedAt
			*(dest[11].(**time.Time)) = nil
			*(dest[12].(**time.Time)) = nil
			*(dest[13].(**string)) = nil
			*(dest[14].(**string)) = nil
			return nil
		},
	}

	incident, err := scanIncidentRow(row)
	if err != nil {
		t.Fatalf("scan incident row: %v", err)
	}
	if incident.Metadata == nil {
		t.Fatalf("expected metadata map, got nil")
	}
	if len(incident.Metadata) != 0 {
		t.Fatalf("expected empty metadata map, got %#v", incident.Metadata)
	}
}

func TestScanIncidentRowReturnsJSONError(t *testing.T) {
	t.Parallel()

	row := fakeIncidentRow{
		scanFn: func(dest ...any) error {
			*(dest[0].(*uuid.UUID)) = uuid.New()
			*(dest[1].(*string)) = "fp"
			*(dest[2].(*string)) = "source"
			*(dest[3].(*string)) = "event"
			*(dest[4].(*string)) = "summary"
			*(dest[5].(*string)) = "medium"
			*(dest[6].(*string)) = "reporter@example.com"
			*(dest[7].(*string)) = string(domain.StatusOpen)
			*(dest[8].(*[]byte)) = []byte(`{"service":`)
			*(dest[9].(*time.Time)) = time.Now().UTC()
			*(dest[10].(*time.Time)) = time.Now().UTC()
			*(dest[11].(**time.Time)) = nil
			*(dest[12].(**time.Time)) = nil
			*(dest[13].(**string)) = nil
			*(dest[14].(**string)) = nil
			return nil
		},
	}

	_, err := scanIncidentRow(row)
	if err == nil {
		t.Fatalf("expected metadata unmarshal error")
	}
	if !strings.Contains(err.Error(), "unmarshal metadata") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestScanIncidentRowReturnsScanError(t *testing.T) {
	t.Parallel()

	row := fakeIncidentRow{
		scanFn: func(dest ...any) error {
			return errors.New("scan failed")
		},
	}

	_, err := scanIncidentRow(row)
	if err == nil {
		t.Fatalf("expected scan error")
	}
	if err.Error() != "scan failed" {
		t.Fatalf("unexpected error: %v", err)
	}
}
