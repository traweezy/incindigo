# syntax=docker/dockerfile:1.7

FROM golang:1.26-alpine AS builder
WORKDIR /src

COPY go.mod go.sum* ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o /out/incindigo-api ./cmd/api

FROM gcr.io/distroless/static-debian12
LABEL org.opencontainers.image.title="incindigo-api"
LABEL org.opencontainers.image.description="Incindigo API service"
LABEL org.opencontainers.image.source="https://github.com/traweezy/incindigo"

WORKDIR /app
COPY --from=builder /out/incindigo-api /app/incindigo-api
EXPOSE 8080
ENTRYPOINT ["/app/incindigo-api"]
