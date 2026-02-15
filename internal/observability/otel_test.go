package observability

import (
	"context"
	"testing"

	"go.uber.org/zap"
)

func TestInitOpenTelemetryDisabled(t *testing.T) {
	t.Parallel()

	shutdown, err := InitOpenTelemetry(
		context.Background(),
		"incindigo-test",
		"http://localhost:4318",
		false,
		zap.NewNop(),
	)
	if err != nil {
		t.Fatalf("expected no error when disabled, got %v", err)
	}
	if shutdown == nil {
		t.Fatalf("expected shutdown function")
	}

	if err := shutdown(context.Background()); err != nil {
		t.Fatalf("shutdown should be no-op, got %v", err)
	}
}
