package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/traweezy/incindigo/internal/features/incidents/app"
	"github.com/traweezy/incindigo/internal/platform/problem"
	"go.uber.org/zap"
)

type Handler struct {
	service   *app.Service
	validator *validator.Validate
	logger    *zap.Logger
}

type webhookRequest struct {
	Fingerprint string         `json:"fingerprint" validate:"required,max=256"`
	Source      string         `json:"source" validate:"required,max=128"`
	EventType   string         `json:"event_type" validate:"required,max=128"`
	Summary     string         `json:"summary" validate:"required,max=512"`
	Severity    string         `json:"severity" validate:"required,oneof=critical high medium low"`
	ReportedBy  string         `json:"reported_by" validate:"required,max=320"`
	Metadata    map[string]any `json:"metadata"`
}

type cancelIncidentRequest struct {
	Reason      string `json:"reason" validate:"required,min=3,max=500"`
	CancelledBy string `json:"cancelled_by" validate:"omitempty,max=320"`
}

func NewHandler(service *app.Service, logger *zap.Logger) *Handler {
	return &Handler{
		service:   service,
		validator: validator.New(validator.WithRequiredStructEnabled()),
		logger:    logger,
	}
}

func (h *Handler) PostWebhook(w http.ResponseWriter, r *http.Request) {
	request := webhookRequest{}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Invalid payload", "Request body must be valid JSON.", nil)
		return
	}
	if request.Metadata == nil {
		request.Metadata = map[string]any{}
	}
	if err := h.validator.Struct(request); err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Validation failed", "One or more fields are invalid.", validationErrors(err))
		return
	}

	incident, created, err := h.service.IngestWebhook(r.Context(), app.WebhookInput{
		Fingerprint: request.Fingerprint,
		Source:      request.Source,
		EventType:   request.EventType,
		Summary:     request.Summary,
		Severity:    request.Severity,
		ReportedBy:  request.ReportedBy,
		Metadata:    request.Metadata,
	})
	if err != nil {
		h.logger.Error("webhook ingest failed", zap.Error(err))
		problem.Write(w, r, http.StatusInternalServerError, "Ingest failed", "Unable to process webhook event.", nil)
		return
	}

	writeJSON(w, http.StatusAccepted, map[string]any{
		"incident":     incident,
		"deduplicated": !created,
	})
}

func (h *Handler) CancelIncident(w http.ResponseWriter, r *http.Request) {
	incidentID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Invalid id", "Incident id must be a UUID.", nil)
		return
	}

	request := cancelIncidentRequest{}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Invalid payload", "Request body must be valid JSON.", nil)
		return
	}
	if err := h.validator.Struct(request); err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Validation failed", "Cancel payload is invalid.", validationErrors(err))
		return
	}

	incident, err := h.service.CancelIncident(r.Context(), incidentID, request.Reason, request.CancelledBy)
	if err != nil {
		if errors.Is(err, app.ErrIncidentNotFound) {
			problem.Write(w, r, http.StatusNotFound, "Not found", "Incident does not exist or is already closed.", nil)
			return
		}
		h.logger.Error("cancel incident failed", zap.Error(err), zap.String("incident_id", incidentID.String()))
		problem.Write(w, r, http.StatusInternalServerError, "Cancel failed", "Unable to cancel incident.", nil)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"incident": incident})
}

func (h *Handler) ListIncidents(w http.ResponseWriter, r *http.Request) {
	limit := int32(100)
	if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err == nil && parsed > 0 && parsed <= 500 {
			limit = int32(parsed)
		}
	}

	incidents, err := h.service.ListIncidents(r.Context(), limit)
	if err != nil {
		h.logger.Error("list incidents failed", zap.Error(err))
		problem.Write(w, r, http.StatusInternalServerError, "List failed", "Unable to list incidents.", nil)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": incidents})
}

func (h *Handler) ResolveIncident(w http.ResponseWriter, r *http.Request) {
	incidentID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Invalid id", "Incident id must be a UUID.", nil)
		return
	}

	incident, err := h.service.ResolveIncident(r.Context(), incidentID)
	if err != nil {
		if errors.Is(err, app.ErrIncidentNotFound) {
			problem.Write(w, r, http.StatusNotFound, "Not found", "Incident does not exist or is already resolved.", nil)
			return
		}
		h.logger.Error("resolve incident failed", zap.Error(err), zap.String("incident_id", incidentID.String()))
		problem.Write(w, r, http.StatusInternalServerError, "Resolve failed", "Unable to resolve incident.", nil)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"incident": incident})
}

func (h *Handler) Overview(w http.ResponseWriter, r *http.Request) {
	overview, err := h.service.Overview(r.Context())
	if err != nil {
		h.logger.Error("overview failed", zap.Error(err))
		problem.Write(w, r, http.StatusInternalServerError, "Overview failed", "Unable to load analytics overview.", nil)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"overview": overview})
}

func validationErrors(err error) []problem.FieldError {
	fieldErrors := []problem.FieldError{}
	var typed validator.ValidationErrors
	if errors.As(err, &typed) {
		for _, validationErr := range typed {
			fieldErrors = append(fieldErrors, problem.FieldError{
				Field:   validationErr.Field(),
				Message: validationErr.ActualTag(),
			})
		}
	}
	return fieldErrors
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
