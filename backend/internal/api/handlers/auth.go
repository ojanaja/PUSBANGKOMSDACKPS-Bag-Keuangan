package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	"github.com/vandal/keuangan-pusbangkom/internal/api/middleware"
	"github.com/vandal/keuangan-pusbangkom/internal/db"
	"github.com/vandal/keuangan-pusbangkom/internal/services"
)

type AuthHandler struct {
	authService *services.AuthService
	queries     *db.Queries
	activity    *services.ActivityLogger
}

func NewAuthHandler(authService *services.AuthService, queries *db.Queries, activity *services.ActivityLogger) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		queries:     queries,
		activity:    activity,
	}
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type userResponse struct {
	ID       string `json:"ID"`
	Username string `json:"Username"`
	FullName string `json:"FullName"`
	Role     string `json:"Role"`
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req loginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Invalid request payload"})
	}

	if req.Username == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Username and password are required"})
	}

	user, err := h.queries.GetUserByUsername(c.Request().Context(), req.Username)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"message": "Invalid username or password"})
	}

	if !h.authService.CheckPasswordHash(req.Password, user.PasswordHash) {
		return c.JSON(http.StatusUnauthorized, map[string]string{"message": "Invalid username or password"})
	}

	token, err := h.authService.GenerateToken(
		fmt.Sprintf("%x-%x-%x-%x-%x", user.ID.Bytes[0:4], user.ID.Bytes[4:6], user.ID.Bytes[6:8], user.ID.Bytes[8:10], user.ID.Bytes[10:16]),
		user.Username,
		user.Role,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to generate token"})
	}

	c.SetCookie(&http.Cookie{
		Name:     "session",
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})

	uID := uuid.UUID(user.ID.Bytes)
	h.activity.Log(c.Request().Context(), uID, "LOGIN", "USER", &uID, nil, c.RealIP(), c.Request().UserAgent())

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "Login successful",
		"user": userResponse{
			ID:       pgUUIDToString(user.ID),
			Username: user.Username,
			FullName: user.FullName,
			Role:     user.Role,
		},
	})
}

func (h *AuthHandler) Logout(c echo.Context) error {
	c.SetCookie(&http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		Expires:  time.Now().Add(-1 * time.Hour),
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})

	claims := middleware.GetClaims(c)
	if claims != nil {
		var uID pgtype.UUID
		if err := uID.Scan(claims.UserID); err == nil {
			idVal := uuid.UUID(uID.Bytes)
			h.activity.Log(c.Request().Context(), idVal, "LOGOUT", "USER", &idVal, nil, c.RealIP(), c.Request().UserAgent())
		}
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func (h *AuthHandler) Me(c echo.Context) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"message": "Unauthorized"})
	}

	var pgID pgtype.UUID
	if err := pgID.Scan(claims.UserID); err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"message": "Invalid user ID in token"})
	}

	user, err := h.queries.GetUser(c.Request().Context(), pgID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"message": "User not found"})
	}

	return c.JSON(http.StatusOK, userResponse{
		ID:       pgUUIDToString(user.ID),
		Username: user.Username,
		FullName: user.FullName,
		Role:     user.Role,
	})
}

func pgUUIDToString(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	b := id.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
