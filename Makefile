APP_NAME := incindigo-api
DB_URL ?= postgres://incindigo:incindigo@localhost:5432/incindigo?sslmode=disable

export INCINDIGO_DATABASE_URL ?= $(DB_URL)

.PHONY: tidy test build dev-api dev-web sqlc migrate-up migrate-down docker-build

tidy:
	go mod tidy

test:
	go test ./...

build:
	go build -trimpath -o bin/$(APP_NAME) ./cmd/api

dev-api:
	go run ./cmd/api

dev-web:
	cd web && pnpm dev

sqlc:
	sqlc generate

migrate-up:
	migrate -path ./migrations -database "$(INCINDIGO_DATABASE_URL)" up

migrate-down:
	migrate -path ./migrations -database "$(INCINDIGO_DATABASE_URL)" down 1

docker-build:
	docker build -t $(APP_NAME):latest .
