package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/traweezy/incindigo/internal/features/incidents/domain"
	"github.com/traweezy/incindigo/internal/platform/problem"
)

type Broker struct {
	subscribe   chan chan []byte
	unsubscribe chan chan []byte
	publish     chan []byte
}

func NewBroker(buffer int) *Broker {
	broker := &Broker{
		subscribe:   make(chan chan []byte),
		unsubscribe: make(chan chan []byte),
		publish:     make(chan []byte, buffer),
	}
	go broker.run()
	return broker
}

func (b *Broker) run() {
	clients := map[chan []byte]struct{}{}
	for {
		select {
		case client := <-b.subscribe:
			clients[client] = struct{}{}
		case client := <-b.unsubscribe:
			delete(clients, client)
			close(client)
		case payload := <-b.publish:
			for client := range clients {
				select {
				case client <- payload:
				default:
				}
			}
		}
	}
}

func (b *Broker) Publish(event domain.TimelineEvent) {
	payload, err := json.Marshal(event)
	if err != nil {
		return
	}

	select {
	case b.publish <- payload:
	default:
	}
}

func (b *Broker) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		problem.Write(w, r, http.StatusInternalServerError, "Streaming unavailable", "Response does not support streaming.", nil)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	client := make(chan []byte, 16)
	b.subscribe <- client
	defer func() {
		b.unsubscribe <- client
	}()

	keepAlive := time.NewTicker(20 * time.Second)
	defer keepAlive.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case payload, ok := <-client:
			if !ok {
				return
			}
			_, _ = w.Write([]byte("event: timeline\n"))
			_, _ = w.Write([]byte("data: "))
			_, _ = w.Write(payload)
			_, _ = w.Write([]byte("\n\n"))
			flusher.Flush()
		case <-keepAlive.C:
			_, _ = w.Write([]byte(": keepalive\n\n"))
			flusher.Flush()
		}
	}
}
