package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/vandal/keuangan-pusbangkom/internal/api/handlers"
	authmw "github.com/vandal/keuangan-pusbangkom/internal/api/middleware"
	"github.com/vandal/keuangan-pusbangkom/internal/db"
	"github.com/vandal/keuangan-pusbangkom/internal/services"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	dbUrl := os.Getenv("DB_URL")
	if dbUrl == "" {
		slog.Error("DB_URL environment variable is required")
		os.Exit(1)
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

	casPath := os.Getenv("CAS_PATH")
	if casPath == "" {
		casPath = "./storage/cas"
	}
	cas := services.NewCASStorage(casPath)

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		slog.Error("JWT_SECRET environment variable is required")
		os.Exit(1)
	}
	authService := services.NewAuthService(jwtSecret)
	activityLogger := services.NewActivityLogger(database)
	authHandler := handlers.NewAuthHandler(authService, database, activityLogger)

	serverHandler := handlers.NewHandler(database, pool, cas, authService, activityLogger)

	e := echo.New()
	e.HideBanner = true

	e.Use(middleware.Recover())
	e.Use(middleware.CSRFWithConfig(middleware.CSRFConfig{
		TokenLookup:    "header:X-CSRF-Token",
		CookieName:     "_csrf",
		CookiePath:     "/",
		CookieHTTPOnly: false,
		CookieSameSite: http.SameSiteLaxMode,
	}))
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogStatus:   true,
		LogURI:      true,
		LogMethod:   true,
		LogLatency:  true,
		LogRemoteIP: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			slog.Info("request",
				slog.String("actor", c.RealIP()),
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
	e.Use(middleware.RequestID())
	e.Use(middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(100)))
	allowOrigins := []string{"http://localhost:5173", "http://localhost:3000"}
	if envOrigins := strings.TrimSpace(os.Getenv("CORS_ALLOW_ORIGINS")); envOrigins != "" {
		parts := strings.Split(envOrigins, ",")
		customOrigins := make([]string, 0, len(parts))
		for _, origin := range parts {
			trimmed := strings.TrimSpace(origin)
			if trimmed != "" {
				customOrigins = append(customOrigins, trimmed)
			}
		}
		if len(customOrigins) > 0 {
			allowOrigins = customOrigins
		}
	}
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     allowOrigins,
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete},
		AllowHeaders:     []string{echo.HeaderContentType, echo.HeaderAccept},
		AllowCredentials: true,
	}))

	authGroup := e.Group("/api/v1/auth")
	authGroup.POST("/login", authHandler.Login)
	authGroup.POST("/logout", authHandler.Logout)
	authGroup.GET("/me", authHandler.Me, authmw.RequireAuth(authService))

	apiGroup := e.Group("/api/v1")
	apiGroup.Use(authmw.RequireAuth(authService))

	handlers.RegisterHandlers(apiGroup, serverHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	go func() {
		if err := e.Start(fmt.Sprintf(":%s", port)); err != nil && err != http.ErrServerClosed {
			e.Logger.Fatal("shutting down the server")
		}
	}()

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
