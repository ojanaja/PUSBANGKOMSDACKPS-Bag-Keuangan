package handlers

import (
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"
)

func (h *Handler) GetHealthz(ctx echo.Context) error {
	return ctx.JSON(http.StatusOK, map[string]string{"status": "UP"})
}

func (h *Handler) GetReadyz(ctx echo.Context) error {
	if err := h.pool.Ping(ctx.Request().Context()); err != nil {
		slog.Error("Database ping failed", "error", err)
		return ctx.JSON(http.StatusServiceUnavailable, map[string]string{"status": "DOWN", "error": "db disconnected"})
	}
	return ctx.JSON(http.StatusOK, map[string]string{"status": "UP"})
}
