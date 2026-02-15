package domain

import (
	"time"

	"github.com/google/uuid"
)

type ChecklistItem struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
}

type MatchRule struct {
	Source              string `json:"source,omitempty"`
	EventType           string `json:"event_type,omitempty"`
	Service             string `json:"service,omitempty"`
	Severity            string `json:"severity,omitempty"`
	FingerprintContains string `json:"fingerprint_contains,omitempty"`
}

type Template struct {
	ID          uuid.UUID       `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Checklist   []ChecklistItem `json:"checklist"`
	Match       MatchRule       `json:"match"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}
