package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/vandal/siap-bpk/internal/api/handlers"
	"github.com/vandal/siap-bpk/internal/db"
)

type RouterImpl struct {
	dbConn *db.Queries
	pool   *pgxpool.Pool
}

// Ensure RouterImpl implements handlers.ServerInterface
var _ handlers.ServerInterface = (*RouterImpl)(nil)

func (r *RouterImpl) GetHealthz(ctx echo.Context) error {
	return ctx.JSON(http.StatusOK, map[string]string{"status": "UP"})
}

func (r *RouterImpl) GetReadyz(ctx echo.Context) error {
	err := r.pool.Ping(ctx.Request().Context())
	if err != nil {
		slog.Error("Database ping failed", "error", err)
		return ctx.JSON(http.StatusServiceUnavailable, map[string]string{"status": "DOWN", "error": "db disconnected"})
	}
	return ctx.JSON(http.StatusOK, map[string]string{"status": "UP"})
}

func main() {
	// 1. Initialize Logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	// 2. Initialize Database Connection
	dbUrl := os.Getenv("DB_URL")
	if dbUrl == "" {
		dbUrl = "postgres://siap_admin:siap_password@localhost:5432/siap_bpk?sslmode=disable" // fallback for local dev
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbUrl)
	if err != nil {
		slog.Error("Unable to create connection pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		slog.Error("Unable to ping database", "error", err)
		os.Exit(1)
	}
	
	slog.Info("Successfully connected to database")
	database := db.New(pool)

	// 3. Initialize Echo
	e := echo.New()
	e.HideBanner = true
	
	// Middleware
	e.Use(middleware.Recover())
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogStatus: true,
		LogURI:    true,
		LogMethod: true,
		LogLatency: true,
		LogRemoteIP: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			slog.Info("request",
				slog.String("actor", c.RealIP()), // Can be updated later with JWT claims
				slog.String("ip", v.RemoteIP),
				slog.String("endpoint", v.URI),
				slog.String("method", v.Method),
				slog.Int("status", v.Status),
				slog.Duration("latency_ms", v.Latency),
				slog.String("trace_id", c.Response().Header().Get(echo.HeaderXRequestID)),
			)
			return nil
		},
	}))
	e.Use(middleware.RequestID()) // Injects trace_id

	// Custom Rate Limiter using Echo standard middleware
	e.Use(middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(10)))

	// Register Handlers
	impl := &RouterImpl{dbConn: database, pool: pool}
	handlers.RegisterHandlersWithBaseURL(e, impl, "/api/v1")

	// 4. Start Server gracefully
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	go func() {
		if err := e.Start(fmt.Sprintf(":%s", port)); err != nil && err != http.ErrServerClosed {
			e.Logger.Fatal("shutting down the server")
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server with a timeout of 10 seconds.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit
	slog.Info("Gracefully shutting down server...")

	ctxTimeout, cancelTimeout := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelTimeout()
	if err := e.Shutdown(ctxTimeout); err != nil {
		e.Logger.Fatal(err)
	}
}
