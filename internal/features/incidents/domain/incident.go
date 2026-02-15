package domain

import (
	"time"

	"github.com/google/uuid"
)

type Status string

const (
	StatusOpen      Status = "open"
	StatusResolved  Status = "resolved"
	StatusCancelled Status = "cancelled"
)

type Incident struct {
	ID           uuid.UUID      `json:"id"`
	Fingerprint  string         `json:"fingerprint"`
	Source       string         `json:"source"`
	EventType    string         `json:"event_type"`
	Summary      string         `json:"summary"`
	Severity     string         `json:"severity"`
	ReportedBy   string         `json:"reported_by"`
	Status       Status         `json:"status"`
	Metadata     map[string]any `json:"metadata"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	ResolvedAt   *time.Time     `json:"resolved_at,omitempty"`
	CancelledAt  *time.Time     `json:"cancelled_at,omitempty"`
	CancelReason *string        `json:"cancel_reason,omitempty"`
	CancelledBy  *string        `json:"cancelled_by,omitempty"`
}

type TimelineEvent struct {
	EventType  string    `json:"event_type"`
	Incident   Incident  `json:"incident"`
	OccurredAt time.Time `json:"occurred_at"`
}
