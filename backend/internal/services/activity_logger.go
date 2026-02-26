package services

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/vandal/keuangan-pusbangkom/internal/db"
)

type ActivityLogger struct {
	queries *db.Queries
}

func NewActivityLogger(queries *db.Queries) *ActivityLogger {
	return &ActivityLogger{queries: queries}
}

func (l *ActivityLogger) Log(ctx context.Context, userID uuid.UUID, action string, targetType string, targetID *uuid.UUID, details map[string]interface{}, ip string, ua string) {
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
		tgID = pgtype.UUID{Bytes: *targetID, Valid: true}
	}

	_, err := l.queries.CreateActivityLog(ctx, db.CreateActivityLogParams{
		ID:         pgtype.UUID{Bytes: uuid.New(), Valid: true},
		UserID:     pgtype.UUID{Bytes: userID, Valid: true},
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
