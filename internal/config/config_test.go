package config

import (
	"os"
	"testing"
	"time"
)

func TestLoadDefaults(t *testing.T) {
	for _, key := range []string{
		"INCINDIGO_ADDR",
		"INCINDIGO_DATABASE_URL",
		"INCINDIGO_PUBLIC_API_BASE_URL",
		"INCINDIGO_OTLP_ENABLED",
		"INCINDIGO_OTLP_ENDPOINT",
		"INCINDIGO_MAGIC_LINK_BASE_URL",
		"INCINDIGO_MAGIC_LINK_TTL",
		"INCINDIGO_AUTO_RESOLVE_AFTER",
		"INCINDIGO_SHUTDOWN_TIMEOUT",
	} {
		t.Setenv(key, "")
	}

	cfg := Load()

	if cfg.HTTPAddr != ":8080" {
		t.Fatalf("unexpected HTTPAddr: %s", cfg.HTTPAddr)
	}
	if cfg.DatabaseURL != "" {
		t.Fatalf("expected empty database URL")
	}
	if cfg.PublicAPIBaseURL != "http://localhost:8080" {
		t.Fatalf("unexpected public API base URL: %s", cfg.PublicAPIBaseURL)
	}
	if cfg.OTLPEnabled {
		t.Fatalf("expected OTLP disabled by default")
	}
	if cfg.OTLPEndpoint != "http://localhost:4318" {
		t.Fatalf("unexpected OTLP endpoint: %s", cfg.OTLPEndpoint)
	}
	if cfg.MagicLinkBaseURL != "http://localhost:5173/auth/verify" {
		t.Fatalf("unexpected magic link base URL: %s", cfg.MagicLinkBaseURL)
	}
	if cfg.MagicLinkTTL != 15*time.Minute {
		t.Fatalf("unexpected magic link ttl: %s", cfg.MagicLinkTTL)
	}
	if cfg.AutoResolveAfter != 2*time.Hour {
		t.Fatalf("unexpected auto resolve duration: %s", cfg.AutoResolveAfter)
	}
	if cfg.ShutdownTimeout != 15*time.Second {
		t.Fatalf("unexpected shutdown timeout: %s", cfg.ShutdownTimeout)
	}
}

func TestLoadEnvOverrides(t *testing.T) {
	t.Setenv("INCINDIGO_ADDR", ":9090")
	t.Setenv("INCINDIGO_DATABASE_URL", "postgres://example")
	t.Setenv("INCINDIGO_PUBLIC_API_BASE_URL", "https://api.example.com")
	t.Setenv("INCINDIGO_OTLP_ENABLED", "true")
	t.Setenv("INCINDIGO_OTLP_ENDPOINT", "https://otel.example.com")
	t.Setenv("INCINDIGO_MAGIC_LINK_BASE_URL", "https://app.example.com/auth/verify")
	t.Setenv("INCINDIGO_MAGIC_LINK_TTL", "45m")
	t.Setenv("INCINDIGO_AUTO_RESOLVE_AFTER", "6h")
	t.Setenv("INCINDIGO_SHUTDOWN_TIMEOUT", "30s")

	cfg := Load()

	if cfg.HTTPAddr != ":9090" {
		t.Fatalf("unexpected HTTPAddr: %s", cfg.HTTPAddr)
	}
	if cfg.DatabaseURL != "postgres://example" {
		t.Fatalf("unexpected database URL: %s", cfg.DatabaseURL)
	}
	if cfg.PublicAPIBaseURL != "https://api.example.com" {
		t.Fatalf("unexpected public API base URL: %s", cfg.PublicAPIBaseURL)
	}
	if !cfg.OTLPEnabled {
		t.Fatalf("expected OTLP to be enabled")
	}
	if cfg.OTLPEndpoint != "https://otel.example.com" {
		t.Fatalf("unexpected OTLP endpoint: %s", cfg.OTLPEndpoint)
	}
	if cfg.MagicLinkBaseURL != "https://app.example.com/auth/verify" {
		t.Fatalf("unexpected magic link base URL: %s", cfg.MagicLinkBaseURL)
	}
	if cfg.MagicLinkTTL != 45*time.Minute {
		t.Fatalf("unexpected magic link ttl: %s", cfg.MagicLinkTTL)
	}
	if cfg.AutoResolveAfter != 6*time.Hour {
		t.Fatalf("unexpected auto resolve duration: %s", cfg.AutoResolveAfter)
	}
	if cfg.ShutdownTimeout != 30*time.Second {
		t.Fatalf("unexpected shutdown timeout: %s", cfg.ShutdownTimeout)
	}
}

func TestLoadInvalidValuesFallback(t *testing.T) {
	t.Setenv("INCINDIGO_OTLP_ENABLED", "invalid")
	t.Setenv("INCINDIGO_MAGIC_LINK_TTL", "xyz")
	t.Setenv("INCINDIGO_AUTO_RESOLVE_AFTER", "xyz")
	t.Setenv("INCINDIGO_SHUTDOWN_TIMEOUT", "xyz")

	cfg := Load()

	if cfg.OTLPEnabled {
		t.Fatalf("expected invalid OTLP bool to fallback to false")
	}
	if cfg.MagicLinkTTL != 15*time.Minute {
		t.Fatalf("expected default ttl, got %s", cfg.MagicLinkTTL)
	}
	if cfg.AutoResolveAfter != 2*time.Hour {
		t.Fatalf("expected default auto resolve duration, got %s", cfg.AutoResolveAfter)
	}
	if cfg.ShutdownTimeout != 15*time.Second {
		t.Fatalf("expected default shutdown timeout, got %s", cfg.ShutdownTimeout)
	}
}

func TestGetenvReturnsFallbackWhenUnset(t *testing.T) {
	_ = os.Unsetenv("INCINDIGO_TEST_KEY")
	if value := getenv("INCINDIGO_TEST_KEY", "fallback"); value != "fallback" {
		t.Fatalf("unexpected getenv fallback: %s", value)
	}
}
