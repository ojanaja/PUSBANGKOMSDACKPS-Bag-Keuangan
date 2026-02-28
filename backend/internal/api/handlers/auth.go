package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/api/middleware"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/services"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

type AuthHandler struct {
	authService *services.AuthService
	queries     *db.Queries
	activity    *services.ActivityLogger
	pool        sqlExecutor
}

func NewAuthHandler(authService *services.AuthService, queries *db.Queries, pool *pgxpool.Pool, activity *services.ActivityLogger) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		queries:     queries,
		pool:        pool,
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

	token, _ := h.authService.GenerateToken(
		fmt.Sprintf("%x-%x-%x-%x-%x", user.ID.Bytes[0:4], user.ID.Bytes[4:6], user.ID.Bytes[6:8], user.ID.Bytes[8:10], user.ID.Bytes[10:16]),
		user.Username,
		user.Role,
	)

	c.SetCookie(&http.Cookie{
		Name:     "session",
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		Secure:   cookieSecureEnabled(),
		SameSite: cookieSameSiteMode(),
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
	if cookie, err := c.Cookie("session"); err == nil && cookie.Value != "" && h.pool != nil {
		exp := time.Now().Add(24 * time.Hour)
		if claims, err := h.authService.ValidateToken(cookie.Value); err == nil && claims.ExpiresAt != nil {
			exp = claims.ExpiresAt.Time
		}

		hash := sha256.Sum256([]byte(cookie.Value))
		tokenHashHex := hex.EncodeToString(hash[:])

		if _, err := h.pool.Exec(
			c.Request().Context(),
			"INSERT INTO revoked_tokens (token_sha256, expires_at) VALUES ($1, $2) ON CONFLICT (token_sha256) DO UPDATE SET expires_at = EXCLUDED.expires_at",
			tokenHashHex,
			exp,
		); err != nil {
			slog.Error("failed to revoke token on logout", "error", err)
			return c.JSON(http.StatusServiceUnavailable, map[string]string{"message": "failed to logout"})
		}
		_, _ = h.pool.Exec(c.Request().Context(), "DELETE FROM revoked_tokens WHERE expires_at < now()")
	}

	c.SetCookie(&http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		Expires:  time.Now().Add(-1 * time.Hour),
		HttpOnly: true,
		Secure:   cookieSecureEnabled(),
		SameSite: cookieSameSiteMode(),
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

func cookieSecureEnabled() bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv("COOKIE_SECURE")))
	if v == "" {
		return true
	}
	if v == "0" || v == "false" || v == "no" || v == "off" {
		return false
	}
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

func cookieSameSiteMode() http.SameSite {
	switch strings.TrimSpace(strings.ToLower(os.Getenv("COOKIE_SAME_SITE"))) {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}
