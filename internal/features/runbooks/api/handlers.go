package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/traweezy/incindigo/internal/features/runbooks/app"
	"github.com/traweezy/incindigo/internal/features/runbooks/domain"
	"github.com/traweezy/incindigo/internal/platform/problem"
	"go.uber.org/zap"
)

type Handler struct {
	service   *app.Service
	validator *validator.Validate
	logger    *zap.Logger
}

type createRunbookRequest struct {
	Name        string              `json:"name" validate:"required,max=150"`
	Description string              `json:"description" validate:"required,max=500"`
	Checklist   []string            `json:"checklist" validate:"required,min=1,dive,required,max=180"`
	Match       runbookMatchRequest `json:"match"`
}

type runbookMatchRequest struct {
	Source              string `json:"source" validate:"omitempty,max=128"`
	EventType           string `json:"event_type" validate:"omitempty,max=128"`
	Service             string `json:"service" validate:"omitempty,max=128"`
	Severity            string `json:"severity" validate:"omitempty,oneof=critical high medium low"`
	FingerprintContains string `json:"fingerprint_contains" validate:"omitempty,max=256"`
}

func NewHandler(service *app.Service, logger *zap.Logger) *Handler {
	return &Handler{
		service:   service,
		validator: validator.New(validator.WithRequiredStructEnabled()),
		logger:    logger,
	}
}

func (h *Handler) ListRunbooks(w http.ResponseWriter, r *http.Request) {
	runbooks, err := h.service.List(r.Context())
	if err != nil {
		h.logger.Error("list runbooks failed", zap.Error(err))
		problem.Write(w, r, http.StatusInternalServerError, "Could not list runbooks", "Try again later.", nil)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": runbooks})
}

func (h *Handler) ListRunbooksForIncident(w http.ResponseWriter, r *http.Request) {
	incidentID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Invalid id", "Incident id must be a UUID.", nil)
		return
	}

	runbooks, err := h.service.ListForIncident(r.Context(), incidentID)
	if err != nil {
		h.logger.Error("list runbooks for incident failed", zap.Error(err), zap.String("incident_id", incidentID.String()))
		problem.Write(w, r, http.StatusInternalServerError, "Could not list incident runbooks", "Try again later.", nil)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": runbooks})
}

func (h *Handler) CreateRunbook(w http.ResponseWriter, r *http.Request) {
	request, err := decodeRunbookRequest(r)
	if err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Invalid payload", "Request body must be valid JSON.", nil)
		return
	}

	if err := h.validator.Struct(request); err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Validation failed", "Runbook payload is invalid.", nil)
		return
	}

	created, err := h.service.Create(r.Context(), domain.Template{
		Name:        strings.TrimSpace(request.Name),
		Description: strings.TrimSpace(request.Description),
		Checklist:   buildChecklist(request.Checklist),
		Match:       normalizeMatch(request.Match),
	})
	if err != nil {
		h.logger.Error("create runbook failed", zap.Error(err))
		problem.Write(w, r, http.StatusInternalServerError, "Could not create runbook", "Try again later.", nil)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"runbook": created})
}

func (h *Handler) UpdateRunbook(w http.ResponseWriter, r *http.Request) {
	runbookID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Invalid id", "Runbook id must be a UUID.", nil)
		return
	}

	request, err := decodeRunbookRequest(r)
	if err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Invalid payload", "Request body must be valid JSON.", nil)
		return
	}

	if err := h.validator.Struct(request); err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Validation failed", "Runbook payload is invalid.", nil)
		return
	}

	updated, err := h.service.Update(r.Context(), runbookID, domain.Template{
		Name:        strings.TrimSpace(request.Name),
		Description: strings.TrimSpace(request.Description),
		Checklist:   buildChecklist(request.Checklist),
		Match:       normalizeMatch(request.Match),
	})
	if err != nil {
		if errors.Is(err, app.ErrRunbookNotFound) {
			problem.Write(w, r, http.StatusNotFound, "Not found", "Runbook does not exist.", nil)
			return
		}
		h.logger.Error("update runbook failed", zap.Error(err), zap.String("runbook_id", runbookID.String()))
		problem.Write(w, r, http.StatusInternalServerError, "Could not update runbook", "Try again later.", nil)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"runbook": updated})
}

func (h *Handler) DeleteRunbook(w http.ResponseWriter, r *http.Request) {
	runbookID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Invalid id", "Runbook id must be a UUID.", nil)
		return
	}

	err = h.service.Delete(r.Context(), runbookID)
	if err != nil {
		if errors.Is(err, app.ErrRunbookNotFound) {
			problem.Write(w, r, http.StatusNotFound, "Not found", "Runbook does not exist.", nil)
			return
		}
		h.logger.Error("delete runbook failed", zap.Error(err), zap.String("runbook_id", runbookID.String()))
		problem.Write(w, r, http.StatusInternalServerError, "Could not delete runbook", "Try again later.", nil)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func decodeRunbookRequest(r *http.Request) (createRunbookRequest, error) {
	request := createRunbookRequest{}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		return createRunbookRequest{}, err
	}

	return request, nil
}

func buildChecklist(items []string) []domain.ChecklistItem {
	checklist := make([]domain.ChecklistItem, 0, len(items))
	for idx, item := range items {
		checklist = append(checklist, domain.ChecklistItem{
			ID:        fmt.Sprintf("item-%d", idx+1),
			Title:     strings.TrimSpace(item),
			Completed: false,
		})
	}

	return checklist
}

func normalizeOptionalField(value string) string {
	normalized := strings.TrimSpace(strings.ToLower(value))
	if normalized == "" {
		return ""
	}
	return normalized
}

func normalizeMatch(input runbookMatchRequest) domain.MatchRule {
	return domain.MatchRule{
		Source:              normalizeOptionalField(input.Source),
		EventType:           normalizeOptionalField(input.EventType),
		Service:             normalizeOptionalField(input.Service),
		Severity:            normalizeOptionalField(input.Severity),
		FingerprintContains: normalizeOptionalField(input.FingerprintContains),
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
