package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	HTTPAddr         string
	DatabaseURL      string
	PublicAPIBaseURL string
	OTLPEnabled      bool
	OTLPEndpoint     string
	MagicLinkBaseURL string
	MagicLinkTTL     time.Duration
	AutoResolveAfter time.Duration
	ShutdownTimeout  time.Duration
}

func Load() Config {
	return Config{
		HTTPAddr:         getenv("INCINDIGO_ADDR", ":8080"),
		DatabaseURL:      getenv("INCINDIGO_DATABASE_URL", ""),
		PublicAPIBaseURL: getenv("INCINDIGO_PUBLIC_API_BASE_URL", "http://localhost:8080"),
		OTLPEnabled:      getenvBool("INCINDIGO_OTLP_ENABLED", false),
		OTLPEndpoint:     getenv("INCINDIGO_OTLP_ENDPOINT", "http://localhost:4318"),
		MagicLinkBaseURL: getenv("INCINDIGO_MAGIC_LINK_BASE_URL", "http://localhost:5173/auth/verify"),
		MagicLinkTTL:     mustDuration("INCINDIGO_MAGIC_LINK_TTL", 15*time.Minute),
		AutoResolveAfter: mustDuration("INCINDIGO_AUTO_RESOLVE_AFTER", 2*time.Hour),
		ShutdownTimeout:  mustDuration("INCINDIGO_SHUTDOWN_TIMEOUT", 15*time.Second),
	}
}

func getenv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
}

func getenvBool(key string, fallback bool) bool {
	value := getenv(key, "")
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func mustDuration(key string, fallback time.Duration) time.Duration {
	value := getenv(key, "")
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}
