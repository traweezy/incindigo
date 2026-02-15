package observability

import (
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

type Metrics struct {
	HTTPRequests      *prometheus.CounterVec
	HTTPDuration      *prometheus.HistogramVec
	IncidentEvents    *prometheus.CounterVec
	MagicLinksIssued  prometheus.Counter
	MagicLinksChecked *prometheus.CounterVec
}

func NewMetrics(registerer prometheus.Registerer) *Metrics {
	metrics := &Metrics{
		HTTPRequests: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "incindigo_http_requests_total",
				Help: "Total HTTP requests received.",
			},
			[]string{"method", "path", "status"},
		),
		HTTPDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "incindigo_http_request_duration_seconds",
				Help:    "HTTP request duration in seconds.",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method", "path"},
		),
		IncidentEvents: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "incindigo_incident_events_total",
				Help: "Incident event count by action.",
			},
			[]string{"action"},
		),
		MagicLinksIssued: prometheus.NewCounter(
			prometheus.CounterOpts{
				Name: "incindigo_magic_links_issued_total",
				Help: "Total number of magic links issued.",
			},
		),
		MagicLinksChecked: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "incindigo_magic_links_verification_total",
				Help: "Magic link verification attempts by outcome.",
			},
			[]string{"outcome"},
		),
	}

	registerer.MustRegister(
		metrics.HTTPRequests,
		metrics.HTTPDuration,
		metrics.IncidentEvents,
		metrics.MagicLinksIssued,
		metrics.MagicLinksChecked,
	)

	return metrics
}

func (m *Metrics) ObserveRequest(method, path string, statusCode int, duration time.Duration) {
	m.HTTPRequests.WithLabelValues(method, path, strconv.Itoa(statusCode)).Inc()
	m.HTTPDuration.WithLabelValues(method, path).Observe(duration.Seconds())
}
