package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/labstack/echo/v4"
)

func (h *Handler) ListAuditLogs(ctx echo.Context, params ListAuditLogsParams) error {
	limit := int32(50)
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}
	offset := int32(0)
	if params.Offset != nil {
		offset = int32(*params.Offset)
	}

	rows, err := h.queries.ListActivityLogs(ctx.Request().Context(), db.ListActivityLogsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		slog.Error("ListActivityLogs failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to list audit logs"})
	}

	total, _ := h.queries.CountActivityLogs(ctx.Request().Context())

	logs := make([]ActivityLog, 0, len(rows))
	for _, row := range rows {
		var details map[string]interface{}
		_ = json.Unmarshal(row.Details, &details)

		logs = append(logs, ActivityLog{
			Id:           pgUUIDToOpenAPI(row.ID),
			UserId:       pgUUIDToOpenAPI(row.UserID),
			UserFullName: &row.UserFullName,
			UserUsername: &row.UserUsername,
			Action:       &row.Action,
			TargetType:   &row.TargetType.String,
			TargetId:     pgUUIDToOpenAPI(row.TargetID),
			Details:      &details,
			IpAddress:    &row.IpAddress.String,
			UserAgent:    &row.UserAgent.String,
			CreatedAt:    &row.CreatedAt.Time,
		})
	}

	return ctx.JSON(http.StatusOK, AuditLogResponse{
		Logs:  &logs,
		Total: ptr(int(total)),
	})
}
