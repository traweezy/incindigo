package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/traweezy/incindigo/internal/config"
	authapi "github.com/traweezy/incindigo/internal/features/auth/api"
	authapp "github.com/traweezy/incindigo/internal/features/auth/app"
	authinfra "github.com/traweezy/incindigo/internal/features/auth/infra"
	incidentsapi "github.com/traweezy/incindigo/internal/features/incidents/api"
	incidentsapp "github.com/traweezy/incindigo/internal/features/incidents/app"
	incidentsinfra "github.com/traweezy/incindigo/internal/features/incidents/infra"
	runbooksapi "github.com/traweezy/incindigo/internal/features/runbooks/api"
	runbooksapp "github.com/traweezy/incindigo/internal/features/runbooks/app"
	runbooksinfra "github.com/traweezy/incindigo/internal/features/runbooks/infra"
	"github.com/traweezy/incindigo/internal/observability"
	"github.com/traweezy/incindigo/internal/platform/httpx"
	"github.com/traweezy/incindigo/internal/platform/store"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.uber.org/zap"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg := config.Load()

	logger, err := observability.NewLogger()
	if err != nil {
		panic(err)
	}
	defer logger.Sync()

	shutdownOTel, err := observability.InitOpenTelemetry(ctx, "incindigo-api", cfg.OTLPEndpoint, cfg.OTLPEnabled, logger)
	if err != nil {
		logger.Fatal("init open telemetry", zap.Error(err))
	}
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = shutdownOTel(shutdownCtx)
	}()

	pool, err := store.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("init postgres", zap.Error(err))
	}
	defer pool.Close()

	registry := prometheus.NewRegistry()
	registry.MustRegister(prometheus.NewGoCollector(), prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}))
	metrics := observability.NewMetrics(registry)

	incidentBroker := incidentsapi.NewBroker(256)
	incidentRepo := incidentsinfra.NewRepository(pool)
	incidentService := incidentsapp.NewService(incidentRepo, incidentBroker, metrics, logger)

	authRepo := authinfra.NewRepository(pool)
	authService := authapp.NewService(authRepo, cfg.MagicLinkBaseURL, cfg.MagicLinkTTL, metrics)

	runbookRepo := runbooksinfra.NewRepository(pool)
	runbookService := runbooksapp.NewService(runbookRepo)

	incidentHandler := incidentsapi.NewHandler(incidentService, logger)
	authHandler := authapi.NewHandler(authService, logger)
	runbookHandler := runbooksapi.NewHandler(runbookService, logger)

	go incidentService.StartAutoResolveWorker(ctx, 30*time.Second, cfg.AutoResolveAfter)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", healthHandler)
	mux.HandleFunc("GET /readyz", readinessHandler(pool))
	mux.Handle("GET /metrics", promhttp.HandlerFor(registry, promhttp.HandlerOpts{}))
	mux.HandleFunc("POST /api/v1/webhooks/events", incidentHandler.PostWebhook)
	mux.HandleFunc("GET /api/v1/incidents", incidentHandler.ListIncidents)
	mux.HandleFunc("GET /api/v1/incidents/overview", incidentHandler.Overview)
	mux.HandleFunc("POST /api/v1/incidents/{id}/resolve", incidentHandler.ResolveIncident)
	mux.HandleFunc("POST /api/v1/incidents/{id}/cancel", incidentHandler.CancelIncident)
	mux.Handle("GET /api/v1/incidents/stream", incidentBroker)
	mux.HandleFunc("GET /api/v1/incidents/{id}/runbooks", runbookHandler.ListRunbooksForIncident)
	mux.HandleFunc("POST /api/v1/auth/magic-link/start", authHandler.StartMagicLink)
	mux.HandleFunc("POST /api/v1/auth/magic-link/verify", authHandler.VerifyMagicLink)
	mux.HandleFunc("GET /api/v1/runbooks", runbookHandler.ListRunbooks)
	mux.HandleFunc("POST /api/v1/runbooks", runbookHandler.CreateRunbook)
	mux.HandleFunc("PUT /api/v1/runbooks/{id}", runbookHandler.UpdateRunbook)
	mux.HandleFunc("DELETE /api/v1/runbooks/{id}", runbookHandler.DeleteRunbook)

	instrumented := otelhttp.NewHandler(mux, "incindigo.http")
	handler := httpx.Chain(
		instrumented,
		httpx.Recover(logger),
		httpx.RequestID(),
		httpx.Logger(logger, metrics),
		httpx.CORS("*"),
		httpx.Timeout(30*time.Second),
	)

	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errorChan := make(chan error, 1)
	go func() {
		logger.Info("starting incindigo api", zap.String("addr", cfg.HTTPAddr))
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errorChan <- err
		}
	}()

	select {
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	case err := <-errorChan:
		logger.Fatal("server failed", zap.Error(err))
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("server shutdown failed", zap.Error(err))
	}

	logger.Info("shutdown complete")
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

func readinessHandler(pool interface{ Ping(context.Context) error }) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"status":"not_ready"}`))
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ready"}`))
	}
}
