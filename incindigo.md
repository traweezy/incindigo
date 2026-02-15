# Codex Agent Build Spec: Incindigo (Go 1.26)
Previous working name: signalforge
New official name: **Incindigo**

Name rationale:
Incindigo combines Incident + Indigo (signal clarity, depth, calm under pressure).
It is distinctive, brandable, and not a generic ops term.

Purpose:
Build a deployable, public demo application that showcases modern Go, concurrency, realtime updates, strong architecture, observability, CI, and production readiness.

Tagline:
Realtime incident intelligence built with modern Go.

Target stack:
- Backend: Go 1.26 (net/http + enhanced ServeMux patterns)
- DB: PostgreSQL 16+
- SQL layer: sqlc + pgx v5
- Migrations: golang-migrate
- Auth: Email magic link (MVP)
- Realtime: SSE
- Observability: OpenTelemetry + Prometheus + zap
- Frontend: React (Vite) + MUI
- Infra: Docker + GitLab CI + deploy to Railway/Fly/Render

------------------------------------------------------------
REPO NAME
------------------------------------------------------------
Repository should be renamed to:
incindigo

All package imports must reference:
module github.com/<your-username>/incindigo

------------------------------------------------------------
README.md (Replace existing README with this content)
------------------------------------------------------------

# Incindigo

Incindigo is a realtime incident correlation and runbook platform built with modern Go.

It demonstrates:
- Clean architecture with the standard library HTTP stack
- Typed SQL via sqlc
- Deterministic incident correlation logic
- Server Sent Events for realtime updates
- Observability-first design (metrics, tracing, structured logs)
- Production-grade CI and containerization

This project is intentionally designed as a portfolio-grade system that feels like a real product.

## Core Features

- Webhook ingest endpoint
- Incident deduplication and correlation
- Auto resolve engine
- Realtime incident timeline via SSE
- Runbook templates and checklist execution
- Full audit trail
- Structured logging, metrics, tracing
- GitLab CI pipeline with Docker build

## Tech Stack

Backend:
- Go 1.26
- net/http + ServeMux method routing
- pgx
- sqlc
- golang-migrate
- zap
- OpenTelemetry
- Prometheus

Frontend:
- React + Vite
- TypeScript
- MUI
- TanStack Query

Database:
- PostgreSQL 16

Infrastructure:
- Docker
- GitLab CI

## Why Incindigo Exists

Most portfolio projects are CRUD demos.

Incindigo is intentionally different.

It demonstrates:
- Concurrency
- State machines
- Correlation logic
- Realtime systems
- Transactional integrity
- Background workers
- Streaming
- Observability

It proves production engineering capability, not tutorial-level knowledge.

## Local Development

### Requirements
- Go 1.26
- Docker
- Node 22+
- pnpm 10+

### Start Postgres

docker compose up -d

### Run migrations

make migrate-up

### Generate SQL code

make sqlc

### Run backend (hot reload)

make dev-api

### Run frontend

make dev-web

------------------------------------------------------------
UI Branding Adjustments
------------------------------------------------------------

Update frontend references:
- AppBar title should display "Incindigo"
- Favicon should use indigo-based accent color
- Primary theme color should be indigo-based palette
- Logo style: simple bold wordmark with slight letter spacing

Theme:
- Default: dark mode
- Accent: indigo spectrum (#4f46e5 or similar)

------------------------------------------------------------
Docker Image Rename
------------------------------------------------------------

Image name should be:
incindigo-api

Update:
- Dockerfile labels
- GitLab CI docker build step
- Deployment config

------------------------------------------------------------
CI Update
------------------------------------------------------------

Update .gitlab-ci.yml:
- Replace all instances of signalforge with incindigo
- Update docker image tag references
- Update deploy script target

------------------------------------------------------------
Deployment Naming
------------------------------------------------------------

If deploying to Railway/Fly/Render:
- Service name: incindigo-api
- Database name: incindigo-db
- Environment prefix: INCINDIGO_

------------------------------------------------------------
Acceptance Criteria After Rename
------------------------------------------------------------

- All references to old name removed
- Module path updated
- CI passes
- Docker image builds
- UI shows Incindigo branding
- README updated
- No leftover references to signalforge

End of rename specification.
