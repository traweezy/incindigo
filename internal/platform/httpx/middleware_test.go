package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/traweezy/incindigo/internal/observability"
	"go.uber.org/zap"
)

func TestRequestIDUsesInboundHeader(t *testing.T) {
	t.Parallel()

	var contextRequestID string
	handler := RequestID()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		contextRequestID = GetRequestID(r.Context())
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("X-Request-Id", "req-from-client")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, recorder.Code)
	}
	if recorder.Header().Get("X-Request-Id") != "req-from-client" {
		t.Fatalf("expected response request id to echo inbound header")
	}
	if contextRequestID != "req-from-client" {
		t.Fatalf("expected request id in context, got %q", contextRequestID)
	}
}

func TestRequestIDGeneratesUUIDWhenHeaderMissing(t *testing.T) {
	t.Parallel()

	handler := RequestID()(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	generatedID := recorder.Header().Get("X-Request-Id")
	if generatedID == "" {
		t.Fatalf("expected generated request id header")
	}
	if _, err := uuid.Parse(generatedID); err != nil {
		t.Fatalf("expected generated request id to be UUID, got %q", generatedID)
	}
}

func TestCORSAllowsConfiguredOrigin(t *testing.T) {
	t.Parallel()

	called := false
	handler := CORS("https://console.example.com")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/incidents", nil)
	req.Header.Set("Origin", "https://console.example.com")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if !called {
		t.Fatalf("expected next handler to run")
	}
	if recorder.Header().Get("Access-Control-Allow-Origin") != "https://console.example.com" {
		t.Fatalf("expected allow origin header for configured origin")
	}
	if recorder.Header().Get("Vary") != "Origin" {
		t.Fatalf("expected Vary: Origin header")
	}
}

func TestCORSPreflightShortCircuits(t *testing.T) {
	t.Parallel()

	called := false
	handler := CORS("*")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/incidents", nil)
	req.Header.Set("Origin", "https://app.example.com")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if called {
		t.Fatalf("expected preflight to short-circuit next handler")
	}
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, recorder.Code)
	}
	if recorder.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Fatalf("expected wildcard allow origin header")
	}
}

func TestRecoverMiddlewareHandlesPanic(t *testing.T) {
	t.Parallel()

	handler := Recover(zap.NewNop())(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("boom")
	}))

	req := httptest.NewRequest(http.MethodGet, "/panic", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, recorder.Code)
	}
}

func TestLoggerMiddlewareRecordsRequestMetrics(t *testing.T) {
	t.Parallel()

	metrics := observability.NewMetrics(prometheus.NewRegistry())
	handler := Logger(zap.NewNop(), metrics)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/incidents", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, recorder.Code)
	}

	count := testutil.ToFloat64(
		metrics.HTTPRequests.WithLabelValues(http.MethodPost, "/api/v1/incidents", "201"),
	)
	if count != 1 {
		t.Fatalf("expected HTTP request metric count 1, got %f", count)
	}
}

func TestLoggerMiddlewarePreservesFlusher(t *testing.T) {
	t.Parallel()

	metrics := observability.NewMetrics(prometheus.NewRegistry())
	supportsFlusher := false
	handler := Logger(zap.NewNop(), metrics)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, supportsFlusher = w.(http.Flusher)
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/incidents/stream", nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)

	if !supportsFlusher {
		t.Fatalf("expected wrapped response writer to preserve http.Flusher")
	}
}

func TestChainAppliesMiddlewaresInOrder(t *testing.T) {
	t.Parallel()

	trace := ""
	middlewareA := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			trace += "A"
			next.ServeHTTP(w, r)
		})
	}
	middlewareB := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			trace += "B"
			next.ServeHTTP(w, r)
		})
	}

	handler := Chain(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		trace += "H"
		w.WriteHeader(http.StatusNoContent)
	}), middlewareA, middlewareB)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)

	if trace != "ABH" {
		t.Fatalf("expected middleware order ABH, got %q", trace)
	}
}

func TestTimeoutBypassesServerSentEventsRequests(t *testing.T) {
	t.Parallel()

	handler := Timeout(10 * time.Millisecond)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(30 * time.Millisecond)
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/incidents/stream", nil)
	req.Header.Set("Accept", "text/event-stream")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, recorder.Code)
	}
}

func TestTimeoutStillAppliesToNonStreamRequests(t *testing.T) {
	t.Parallel()

	handler := Timeout(10 * time.Millisecond)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(30 * time.Millisecond)
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/incidents", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, recorder.Code)
	}
}
