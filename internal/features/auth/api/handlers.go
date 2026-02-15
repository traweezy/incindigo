package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/traweezy/incindigo/internal/features/auth/app"
	"github.com/traweezy/incindigo/internal/platform/problem"
	"go.uber.org/zap"
)

type Handler struct {
	service   *app.Service
	validator *validator.Validate
	logger    *zap.Logger
}

type startMagicLinkRequest struct {
	Email string `json:"email" validate:"required,email,max=320"`
}

type verifyMagicLinkRequest struct {
	Token string `json:"token" validate:"required,min=20"`
}

func NewHandler(service *app.Service, logger *zap.Logger) *Handler {
	return &Handler{
		service:   service,
		validator: validator.New(validator.WithRequiredStructEnabled()),
		logger:    logger,
	}
}

func (h *Handler) StartMagicLink(w http.ResponseWriter, r *http.Request) {
	request := startMagicLinkRequest{}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Invalid payload", "Request body must be valid JSON.", nil)
		return
	}

	if err := h.validator.Struct(request); err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Validation failed", "Email must be valid.", nil)
		return
	}

	result, err := h.service.IssueMagicLink(r.Context(), request.Email)
	if err != nil {
		h.logger.Error("issue magic link failed", zap.Error(err))
		problem.Write(w, r, http.StatusInternalServerError, "Could not issue magic link", "Please try again.", nil)
		return
	}

	writeJSON(w, http.StatusAccepted, map[string]any{
		"message": "If this email exists, we sent a magic link.",
		"preview": result.Link,
		"expires": result.ExpiresAt,
	})
}

func (h *Handler) VerifyMagicLink(w http.ResponseWriter, r *http.Request) {
	request := verifyMagicLinkRequest{}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Invalid payload", "Request body must be valid JSON.", nil)
		return
	}

	if err := h.validator.Struct(request); err != nil {
		problem.Write(w, r, http.StatusBadRequest, "Validation failed", "Token is missing.", nil)
		return
	}

	email, ok, err := h.service.VerifyMagicLink(r.Context(), request.Token)
	if err != nil {
		h.logger.Error("verify magic link failed", zap.Error(err))
		problem.Write(w, r, http.StatusInternalServerError, "Verification failed", "Please try again.", nil)
		return
	}
	if !ok {
		problem.Write(w, r, http.StatusUnauthorized, "Invalid link", "The magic link is invalid or expired.", nil)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"authenticated": true,
		"email":         email,
		"session_token": uuid.NewString(),
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
