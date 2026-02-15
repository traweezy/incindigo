package observability

import (
	"context"
	"net/url"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.uber.org/zap"
)

func InitOpenTelemetry(ctx context.Context, serviceName, endpoint string, enabled bool, logger *zap.Logger) (func(context.Context) error, error) {
	if !enabled {
		shutdown := func(context.Context) error { return nil }
		return shutdown, nil
	}

	options := []otlptracehttp.Option{}
	if endpoint != "" {
		parsed, err := url.Parse(endpoint)
		if err == nil && parsed.Host != "" {
			options = append(options, otlptracehttp.WithEndpoint(parsed.Host))
			if parsed.Scheme == "http" {
				options = append(options, otlptracehttp.WithInsecure())
			}
		}
	}

	exporter, err := otlptracehttp.New(ctx, options...)
	if err != nil {
		return nil, err
	}

	res, err := resource.Merge(
		resource.Default(),
		resource.NewSchemaless(attribute.String("service.name", serviceName)),
	)
	if err != nil {
		return nil, err
	}

	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)

	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	logger.Info("otlp tracing enabled", zap.String("endpoint", endpoint))

	return provider.Shutdown, nil
}
