# Incindigo

Incindigo is a realtime incident command platform built to demonstrate production-grade backend and frontend engineering in a single repository.

It covers:
- webhook ingestion and incident deduplication
- background auto-resolution workflows
- SSE-driven live timeline updates
- server-computed analytics for operational visibility
- typed React frontend with modern DX and testing
- observability-first backend design (logs, metrics, tracing)

## Architecture

### Backend (Go)
- `net/http` method routing with explicit middleware chain
- layered features (`api` -> `app` -> `infra` -> `domain`)
- PostgreSQL via `pgx`
- SQL schema and query generation with `sqlc`
- background worker for auto-resolve logic
- SSE broker for realtime event fan-out

### Frontend (React + Vite)
- React 19 + TypeScript + React Router
- Tailwind v4 + Radix primitives
- TanStack Query for async server state
- vitest + testing-library for unit tests
- Playwright for end-to-end and viewport audit tests

## Key Features

- Incident ingest endpoint (`/api/v1/webhooks/events`)
- Incident list and resolve endpoints
- Live event stream (`/api/v1/incidents/stream`)
- Analytics overview (`/api/v1/incidents/overview`)
- Responsive live board with filtering, sorting, and creation dialog
- Analytics page with server-computed trend panels and live activity feed

## Repository Layout

```text
.
├── cmd/api                 # API entrypoint and server wiring
├── internal                # app/features/platform/observability code
├── db/query                # sqlc query definitions
├── migrations              # database migrations
├── web                     # frontend app (Vite + React)
├── deploy                  # deployment scripts/config
├── Dockerfile
├── docker-compose.yml
└── run.sh                  # one-command local boot + teardown
```

## Requirements

- Go `1.26+`
- Node `22+`
- pnpm `10+`
- Docker

## Quickstart

Run the full stack:

```bash
./run.sh
```

What `run.sh` does:
1. starts PostgreSQL with Docker Compose
2. runs migrations
3. installs frontend dependencies
4. starts API (`:8080`) and frontend (`:5173`)
5. on exit (`Ctrl+C`), tears down API/web processes and Docker resources

## Manual Local Development

### Backend

```bash
# Start DB
docker compose up -d

# Run migrations
make migrate-up

# Start API
make dev-api
```

### Frontend

```bash
cd web
pnpm install --frozen-lockfile
pnpm dev
```

## Quality Gates

### Backend

```bash
go test ./...
go test -race ./...
go vet ./...
```

### Frontend

```bash
cd web
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
pnpm build
```

## GitHub Actions

Two GitHub Actions workflows are included:

- `Backend CI` (`.github/workflows/backend-ci.yml`)
  - grouped jobs: quality, tests, race, security, build
  - checks: gofmt, `go mod tidy` consistency, `go vet`, `go test`, `go test -race`, `govulncheck`, binary build, Docker build

- `Frontend CI` (`.github/workflows/frontend-ci.yml`)
  - grouped jobs: quality, unit, build, e2e
  - checks (including the baseline from the reference workflow): install, lint, test, build
  - additional gates: typecheck, format check, Playwright e2e, report artifact upload

## API Endpoints

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `POST /api/v1/webhooks/events`
- `GET /api/v1/incidents`
- `POST /api/v1/incidents/{id}/resolve`
- `GET /api/v1/incidents/overview`
- `GET /api/v1/incidents/stream`

## Deployment Notes

- Build image:

```bash
docker build -t incindigo-api:latest .
```

- The repository also contains Render deployment scaffolding in `deploy/`.
