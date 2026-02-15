#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

DB_CONTAINER_NAME="incindigo-db"
DB_URL="postgres://incindigo:incindigo@localhost:5432/incindigo?sslmode=disable"
MIGRATION_DB_URL="postgres://incindigo:incindigo@postgres:5432/incindigo?sslmode=disable"
API_PORT=8080
WEB_PORT=5173
CLEANED_UP=0

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

port_5432_in_use() {
  ss -ltn "( sport = :5432 )" | grep -q LISTEN
}

container_owns_5432() {
  docker ps --filter "name=^${DB_CONTAINER_NAME}$" --format "{{.Ports}}" | grep -Eq "(0\\.0\\.0\\.0:5432|:::5432)"
}

wait_for_db() {
  local status=""
  for _ in $(seq 1 60); do
    status="$(docker inspect --format '{{if .State.Running}}{{.State.Health.Status}}{{else}}stopped{{end}}' "${DB_CONTAINER_NAME}" 2>/dev/null || true)"
    if [[ "${status}" == "healthy" ]]; then
      return 0
    fi
    sleep 1
  done

  echo "Database did not become healthy in time." >&2
  docker logs --tail 50 "${DB_CONTAINER_NAME}" || true
  return 1
}

get_compose_network() {
  docker inspect "${DB_CONTAINER_NAME}" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' | head -n 1
}

cleanup() {
  if [[ "${CLEANED_UP}" -eq 1 ]]; then
    return
  fi
  CLEANED_UP=1

  terminate_process_tree "${API_PID:-}"
  terminate_process_tree "${WEB_PID:-}"
  kill_port_listener "${API_PORT}"
  kill_port_listener "${WEB_PORT}"
  docker compose down >/dev/null 2>&1 || true
  wait >/dev/null 2>&1 || true
}

terminate_process_tree() {
  local pid="${1:-}"
  if [[ -z "${pid}" ]]; then
    return
  fi

  if ! kill -0 "${pid}" >/dev/null 2>&1; then
    return
  fi

  local child
  while IFS= read -r child; do
    terminate_process_tree "${child}"
  done < <(pgrep -P "${pid}" 2>/dev/null || true)

  kill "${pid}" >/dev/null 2>&1 || true
  for _ in $(seq 1 10); do
    if ! kill -0 "${pid}" >/dev/null 2>&1; then
      return
    fi
    sleep 0.1
  done

  kill -9 "${pid}" >/dev/null 2>&1 || true
}

kill_port_listener() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "${pids}" ]]; then
    return
  fi

  kill ${pids} >/dev/null 2>&1 || true
  sleep 0.2

  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    kill -9 ${pids} >/dev/null 2>&1 || true
  fi
}

require_cmd docker
require_cmd go
require_cmd pnpm
require_cmd ss
require_cmd pgrep
require_cmd lsof

trap cleanup EXIT

if port_5432_in_use && ! container_owns_5432; then
  echo "Port 5432 is already in use by another process." >&2
  echo "Stop that process first to keep Incindigo local and deployed defaults aligned." >&2
  ss -ltnp "( sport = :5432 )" || true
  exit 1
fi

echo "Starting PostgreSQL container..."
docker compose up -d postgres
wait_for_db

COMPOSE_NETWORK="$(get_compose_network)"
if [[ -z "${COMPOSE_NETWORK}" ]]; then
  echo "Could not determine Docker Compose network for ${DB_CONTAINER_NAME}." >&2
  exit 1
fi

echo "Running migrations..."
docker run --rm \
  --network "${COMPOSE_NETWORK}" \
  -v "${ROOT_DIR}/migrations:/migrations:ro" \
  migrate/migrate:v4.18.3 \
  -path=/migrations \
  -database "${MIGRATION_DB_URL}" \
  up

echo "Installing frontend dependencies..."
pnpm --dir web install --frozen-lockfile

echo "Starting API and web dev servers..."

INCINDIGO_DATABASE_URL="${DB_URL}" go run ./cmd/api &
API_PID=$!

pnpm --dir web dev &
WEB_PID=$!

set +e
wait -n "${API_PID}" "${WEB_PID}"
wait_status=$?
set -e

trap - EXIT
cleanup
exit "${wait_status}"
