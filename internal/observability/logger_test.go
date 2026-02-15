package observability

import "testing"

func TestNewLogger(t *testing.T) {
	t.Parallel()

	logger, err := NewLogger()
	if err != nil {
		t.Fatalf("expected logger without error, got %v", err)
	}
	if logger == nil {
		t.Fatalf("expected non-nil logger")
	}

	_ = logger.Sync()
}
