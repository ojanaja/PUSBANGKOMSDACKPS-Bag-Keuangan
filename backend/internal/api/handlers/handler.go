package handlers

import (
	"context"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/services"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type txBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
	Ping(ctx context.Context) error
}

type sqlExecutor interface {
	Exec(ctx context.Context, sql string, arguments ...interface{}) (pgconn.CommandTag, error)
}

type Handler struct {
	queries *db.Queries
	pool    txBeginner
	cas     *services.CASStorage
	auth    *services.AuthService
}

func NewHandler(queries *db.Queries, pool *pgxpool.Pool, cas *services.CASStorage, auth *services.AuthService) *Handler {
	return &Handler{
		queries: queries,
		pool:    pool,
		cas:     cas,
		auth:    auth,
	}
}

var _ ServerInterface = (*Handler)(nil)
