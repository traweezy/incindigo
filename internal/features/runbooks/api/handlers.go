package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-playground/validator/v10"
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
	Name        string   `json:"name" validate:"required,max=150"`
	Description string   `json:"description" validate:"required,max=500"`
	Checklist   []string `json:"checklist" validate:"required,min=1,dive,required,max=180"`
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

func (h *Handler) CreateRunbook(w http.ResponseWriter, r *http.Request) {
	request := createRunbookRequest{}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Invalid payload", "Request body must be valid JSON.", nil)
		return
	}

	if err := h.validator.Struct(request); err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Validation failed", "Runbook payload is invalid.", nil)
		return
	}

	checklist := make([]domain.ChecklistItem, 0, len(request.Checklist))
	for idx, item := range request.Checklist {
		checklist = append(checklist, domain.ChecklistItem{
			ID:        fmt.Sprintf("item-%d", idx+1),
			Title:     item,
			Completed: false,
		})
	}

	created, err := h.service.Create(r.Context(), domain.Template{
		Name:        request.Name,
		Description: request.Description,
		Checklist:   checklist,
	})
	if err != nil {
		h.logger.Error("create runbook failed", zap.Error(err))
		problem.Write(w, r, http.StatusInternalServerError, "Could not create runbook", "Try again later.", nil)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"runbook": created})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
