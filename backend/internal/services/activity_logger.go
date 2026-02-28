package services

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/util"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type ActivityLogger struct {
	queries *db.Queries
}

func NewActivityLogger(queries *db.Queries) *ActivityLogger {
	return &ActivityLogger{queries: queries}
}

func (l *ActivityLogger) Log(ctx context.Context, userID uuid.UUID, action string, targetType string, targetID *uuid.UUID, details map[string]interface{}, ip string, ua string) {
	logCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
	defer cancel()

	var detailsJSON []byte
	if details != nil {
		var err error
		detailsJSON, err = json.Marshal(details)
		if err != nil {
			slog.Error("Failed to marshal activity log details", "error", err)
		}
	}

	var tgID pgtype.UUID
	if targetID != nil {
		tgID = util.UUIDToPgUUID(*targetID)
	}

	_, err := l.queries.CreateActivityLog(logCtx, db.CreateActivityLogParams{
		ID:         util.NewPgUUID(),
		UserID:     util.UUIDToPgUUID(userID),
		Action:     action,
		TargetType: pgtype.Text{String: targetType, Valid: targetType != ""},
		TargetID:   tgID,
		Details:    detailsJSON,
		IpAddress:  pgtype.Text{String: ip, Valid: ip != ""},
		UserAgent:  pgtype.Text{String: ua, Valid: ua != ""},
	})

	if err != nil {
		slog.Error("Failed to create activity log", "error", err, "action", action, "userID", userID)
	}
}
