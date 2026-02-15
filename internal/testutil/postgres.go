package testutil

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

const postgresImage = "postgres:16-alpine"

func StartPostgres(t *testing.T) *pgxpool.Pool {
	t.Helper()

	ctx := context.Background()
	container, err := postgres.Run(
		ctx,
		postgresImage,
		postgres.WithDatabase("incindigo"),
		postgres.WithUsername("incindigo"),
		postgres.WithPassword("incindigo"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(90*time.Second),
		),
	)
	if err != nil {
		t.Skipf("skipping integration test (container unavailable): %v", err)
	}

	t.Cleanup(func() {
		_ = container.Terminate(context.Background())
	})

	connectionString, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("postgres connection string: %v", err)
	}

	pool, err := pgxpool.New(ctx, connectionString)
	if err != nil {
		t.Fatalf("open postgres pool: %v", err)
	}

	t.Cleanup(pool.Close)

	if err := waitForPool(ctx, pool, 15*time.Second); err != nil {
		t.Fatalf("postgres readiness: %v", err)
	}

	if err := applyBaseMigration(ctx, pool); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}

	return pool
}

func waitForPool(ctx context.Context, pool *pgxpool.Pool, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for {
		pingCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
		err := pool.Ping(pingCtx)
		cancel()
		if err == nil {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("ping timeout: %w", err)
		}
		time.Sleep(150 * time.Millisecond)
	}
}

func applyBaseMigration(ctx context.Context, pool *pgxpool.Pool) error {
	_, filePath, _, ok := runtime.Caller(0)
	if !ok {
		return fmt.Errorf("resolve current file path")
	}

	repoRoot := filepath.Clean(filepath.Join(filepath.Dir(filePath), "..", ".."))
	migrationPath := filepath.Join(repoRoot, "migrations", "000001_init.up.sql")
	migrationSQL, err := os.ReadFile(migrationPath)
	if err != nil {
		return fmt.Errorf("read migration %s: %w", migrationPath, err)
	}

	if _, err := pool.Exec(ctx, string(migrationSQL)); err != nil {
		return fmt.Errorf("exec base migration: %w", err)
	}

	return nil
}
