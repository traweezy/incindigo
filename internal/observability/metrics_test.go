package observability

import (
	"net/http"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
)

func TestObserveRequestIncrementsCountersAndHistograms(t *testing.T) {
	t.Parallel()

	registry := prometheus.NewRegistry()
	metrics := NewMetrics(registry)

	metrics.ObserveRequest(http.MethodGet, "/readyz", http.StatusOK, 250*time.Millisecond)

	counterValue := testutil.ToFloat64(
		metrics.HTTPRequests.WithLabelValues(http.MethodGet, "/readyz", "200"),
	)
	if counterValue != 1 {
		t.Fatalf("expected request counter to equal 1, got %f", counterValue)
	}

	if testutil.CollectAndCount(metrics.HTTPDuration) != 1 {
		t.Fatalf("expected one histogram metric sample")
	}
}
