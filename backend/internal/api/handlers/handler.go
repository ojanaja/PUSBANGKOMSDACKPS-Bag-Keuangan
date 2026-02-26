package handlers

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vandal/keuangan-pusbangkom/internal/db"
	"github.com/vandal/keuangan-pusbangkom/internal/services"
)

type Handler struct {
	queries  *db.Queries
	pool     *pgxpool.Pool
	cas      *services.CASStorage
	auth     *services.AuthService
	activity *services.ActivityLogger
}

func NewHandler(queries *db.Queries, pool *pgxpool.Pool, cas *services.CASStorage, auth *services.AuthService, activity *services.ActivityLogger) *Handler {
	return &Handler{
		queries:  queries,
		pool:     pool,
		cas:      cas,
		auth:     auth,
		activity: activity,
	}
}

var _ ServerInterface = (*Handler)(nil)
