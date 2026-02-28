package services

import (
	"context"
	"log/slog"
	"time"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
)

func StartActivityLogCleanup(ctx context.Context, queries *db.Queries, retentionDays int, interval time.Duration) {
	if queries == nil {
		return
	}
	if retentionDays <= 0 {
		return
	}
	if interval <= 0 {
		interval = 24 * time.Hour
	}

	runOnce := func() {
		cutoff := time.Now().AddDate(0, 0, -retentionDays)
		deleted, err := queries.DeleteActivityLogsBefore(ctx, pgtype.Timestamptz{Time: cutoff, Valid: true})
		if err != nil {
			slog.Error("activity log cleanup failed", "error", err)
			return
		}
		if deleted > 0 {
			slog.Info("activity log cleanup completed", "deleted", deleted, "retention_days", retentionDays)
		}
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		runOnce()

		for {
			select {
			case <-ticker.C:
				runOnce()
			case <-ctx.Done():
				slog.Info("activity log cleanup stopped")
				return
			}
		}
	}()

	slog.Info("activity log cleanup started", "retention_days", retentionDays, "interval", interval.String())
}
