package handlers

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	openapi_types "github.com/oapi-codegen/runtime/types"
	authmw "github.com/vandal/keuangan-pusbangkom/internal/api/middleware"
	"github.com/vandal/keuangan-pusbangkom/internal/db"
)

func (h *Handler) ListUsers(ctx echo.Context) error {
	claims := authmw.GetClaims(ctx)
	if claims == nil || claims.Role != "SUPER_ADMIN" {
		return ctx.JSON(http.StatusForbidden, map[string]string{"message": "forbidden: super admin only"})
	}

	users, err := h.queries.ListUsers(ctx.Request().Context())
	if err != nil {
		slog.Error("ListUsers failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to list users"})
	}

	type UserResponse struct {
		ID        string `json:"ID"`
		Username  string `json:"Username"`
		FullName  string `json:"FullName"`
		Role      string `json:"Role"`
		CreatedAt string `json:"CreatedAt"`
	}

	response := make([]UserResponse, len(users))
	for i, u := range users {
		idStr := ""
		if u.ID.Valid {
			uid, err := uuid.FromBytes(u.ID.Bytes[:])
			if err == nil {
				idStr = uid.String()
			}
		}

		createdAt := ""
		if u.CreatedAt.Valid {
			createdAt = u.CreatedAt.Time.Format(time.RFC3339)
		}

		response[i] = UserResponse{
			ID:        idStr,
			Username:  u.Username,
			FullName:  u.FullName,
			Role:      u.Role,
			CreatedAt: createdAt,
		}
	}
	return ctx.JSON(http.StatusOK, response)
}

func (h *Handler) CreateUser(ctx echo.Context) error {
	claims := authmw.GetClaims(ctx)
	if claims == nil || claims.Role != "SUPER_ADMIN" {
		return ctx.JSON(http.StatusForbidden, map[string]string{"message": "forbidden: super admin only"})
	}

	var body CreateUserRequest
	if err := ctx.Bind(&body); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid request body"})
	}

	hashedPassword, err := h.auth.HashPassword(body.Password)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to hash password"})
	}

	user, err := h.queries.CreateUser(ctx.Request().Context(), db.CreateUserParams{
		ID:           newPgUUID(),
		Username:     body.Username,
		PasswordHash: hashedPassword,
		FullName:     body.FullName,
		Role:         string(body.Role),
	})
	if err != nil {
		slog.Error("CreateUser failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to create user (maybe username already exists)"})
	}

	adminID, _ := uuid.Parse(claims.UserID)
	h.activity.Log(ctx.Request().Context(), adminID, "CREATE_USER", "user", ptr(uuid.UUID(user.ID.Bytes)), map[string]interface{}{"username": body.Username}, ctx.RealIP(), ctx.Request().UserAgent())

	return ctx.JSON(http.StatusCreated, user)
}

func (h *Handler) UpdateUser(ctx echo.Context, id openapi_types.UUID) error {
	claims := authmw.GetClaims(ctx)
	if claims == nil || claims.Role != "SUPER_ADMIN" {
		return ctx.JSON(http.StatusForbidden, map[string]string{"message": "forbidden: super admin only"})
	}

	var body UpdateUserRequest
	if err := ctx.Bind(&body); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid request body"})
	}

	currentUser, err := h.queries.GetUser(ctx.Request().Context(), uuidToPgUUID(uuid.UUID(id)))
	if err != nil {
		return ctx.JSON(http.StatusNotFound, map[string]string{"message": "user not found"})
	}

	fullName := currentUser.FullName
	if body.FullName != nil {
		fullName = *body.FullName
	}

	role := currentUser.Role
	if body.Role != nil {
		role = string(*body.Role)
	}

	passwordHash := currentUser.PasswordHash
	if body.Password != nil && *body.Password != "" {
		hashed, err := h.auth.HashPassword(*body.Password)
		if err != nil {
			return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to hash password"})
		}
		passwordHash = hashed
	}

	user, err := h.queries.UpdateUser(ctx.Request().Context(), db.UpdateUserParams{
		ID:           uuidToPgUUID(uuid.UUID(id)),
		FullName:     fullName,
		Role:         role,
		PasswordHash: passwordHash,
	})
	if err != nil {
		slog.Error("UpdateUser failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to update user"})
	}

	adminID, _ := uuid.Parse(claims.UserID)
	h.activity.Log(ctx.Request().Context(), adminID, "UPDATE_USER", "user", ptr(uuid.UUID(id)), map[string]interface{}{"username": currentUser.Username}, ctx.RealIP(), ctx.Request().UserAgent())

	return ctx.JSON(http.StatusOK, user)
}

func (h *Handler) DeleteUser(ctx echo.Context, id openapi_types.UUID) error {
	claims := authmw.GetClaims(ctx)
	if claims == nil || claims.Role != "SUPER_ADMIN" {
		return ctx.JSON(http.StatusForbidden, map[string]string{"message": "forbidden: super admin only"})
	}

	err := h.queries.DeleteUser(ctx.Request().Context(), uuidToPgUUID(uuid.UUID(id)))
	if err != nil {
		slog.Error("DeleteUser failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to delete user"})
	}

	adminID, _ := uuid.Parse(claims.UserID)
	h.activity.Log(ctx.Request().Context(), adminID, "DELETE_USER", "user", ptr(uuid.UUID(id)), nil, ctx.RealIP(), ctx.Request().UserAgent())

	return ctx.NoContent(http.StatusNoContent)
}
