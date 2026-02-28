package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"time"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/api/handlers"
	authmw "github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/api/middleware"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/services"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
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

	connectCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	poolCfg, err := pgxpool.ParseConfig(dbUrl)
	if err != nil {
		slog.Error("Unable to parse DB_URL", "error", err)
		os.Exit(1)
	}
	poolCfg.MaxConns = envInt32("DB_MAX_CONNS", 4)
	poolCfg.MinConns = envInt32("DB_MIN_CONNS", 0)
	poolCfg.MaxConnIdleTime = envDuration("DB_MAX_CONN_IDLE_TIME", 5*time.Minute)
	poolCfg.MaxConnLifetime = envDuration("DB_MAX_CONN_LIFETIME", 30*time.Minute)
	poolCfg.HealthCheckPeriod = envDuration("DB_HEALTHCHECK_PERIOD", 1*time.Minute)

	pool, err := pgxpool.NewWithConfig(connectCtx, poolCfg)
	if err != nil {
		slog.Error("Unable to create connection pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(connectCtx); err != nil {
		slog.Error("Unable to ping database", "error", err)
		os.Exit(1)
	}

	slog.Info("Successfully connected to database")
	database := db.New(pool)

	appCtx, appCancel := context.WithCancel(context.Background())
	defer appCancel()

	retentionDays := int(envInt32("AUDIT_LOG_RETENTION_DAYS", 0))
	if retentionDays > 0 {
		cleanupInterval := envDuration("AUDIT_LOG_CLEANUP_INTERVAL", 24*time.Hour)
		services.StartActivityLogCleanup(appCtx, database, retentionDays, cleanupInterval)
	}

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
	authHandler := handlers.NewAuthHandler(authService, database, pool, activityLogger)

	serverHandler := handlers.NewHandler(database, pool, cas, authService, activityLogger)

	e := echo.New()
	e.HideBanner = true
	e.HTTPErrorHandler = jsonHTTPErrorHandler

	e.Use(middleware.Recover())
	bodyLimit := strings.TrimSpace(os.Getenv("BODY_LIMIT"))
	if bodyLimit == "" {
		bodyLimit = "50M"
	}
	e.Use(middleware.BodyLimit(bodyLimit))
	e.Use(middleware.CSRFWithConfig(middleware.CSRFConfig{
		TokenLookup:    "header:X-CSRF-Token",
		CookieName:     "_csrf",
		CookiePath:     "/",
		CookieHTTPOnly: false,
		CookieSameSite: http.SameSiteLaxMode,
	}))
	e.Use(middleware.RequestID())
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
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderContentType, echo.HeaderAccept, echo.HeaderXRequestedWith, "X-CSRF-Token", "x-csrf-token"},
		AllowCredentials: true,
	}))

	authGroup := e.Group("/api/v1/auth")
	authGroup.POST("/login", authHandler.Login)
	authGroup.POST("/logout", authHandler.Logout)
	authGroup.GET("/me", authHandler.Me, authmw.RequireAuth(authService, pool))

	e.GET("/healthz", serverHandler.GetHealthz)
	e.GET("/readyz", serverHandler.GetReadyz)

	apiGroup := e.Group("/api/v1")
	apiGroup.Use(authmw.RequireAuth(authService, pool))

	wrapper := handlers.ServerInterfaceWrapper{Handler: serverHandler}
	apiGroup.POST("/anggaran/import", wrapper.ImportAnggaranData)
	apiGroup.POST("/anggaran/manual", wrapper.CreateManualAnggaran)
	apiGroup.GET("/anggaran/tree", wrapper.GetAnggaranTree)
	apiGroup.GET("/audit-logs", wrapper.ListAuditLogs, authmw.RequireRole("SUPER_ADMIN"))
	apiGroup.GET("/dashboard/chart", wrapper.GetDashboardChart)
	apiGroup.GET("/dashboard/drilldown", wrapper.GetDashboardDrilldown)
	apiGroup.GET("/dashboard/ews", wrapper.GetDashboardEWS)
	apiGroup.GET("/dashboard/notifications", wrapper.GetDashboardNotifications)
	apiGroup.POST("/documents", wrapper.UploadDocument)
	apiGroup.GET("/documents/:id", wrapper.DownloadDocument)
	apiGroup.GET("/healthz", wrapper.GetHealthz)
	apiGroup.GET("/paket", wrapper.ListPaket)
	apiGroup.POST("/paket", wrapper.CreatePaket)
	apiGroup.GET("/paket/export", wrapper.ExportPaketExcel)
	apiGroup.DELETE("/paket/:id", wrapper.DeletePaket)
	apiGroup.GET("/paket/:id", wrapper.GetPaket)
	apiGroup.PUT("/paket/:id", wrapper.UpdatePaket)
	apiGroup.GET("/paket/:id/documents", wrapper.GetDocumentsByPaket)
	apiGroup.PUT("/paket/:id/realisasi", wrapper.UpdateRealisasiFisik)
	apiGroup.GET("/readyz", wrapper.GetReadyz)
	apiGroup.GET("/users", wrapper.ListUsers, authmw.RequireRole("SUPER_ADMIN"))
	apiGroup.POST("/users", wrapper.CreateUser, authmw.RequireRole("SUPER_ADMIN"))
	apiGroup.DELETE("/users/:id", wrapper.DeleteUser, authmw.RequireRole("SUPER_ADMIN"))
	apiGroup.PUT("/users/:id", wrapper.UpdateUser, authmw.RequireRole("SUPER_ADMIN"))
	apiGroup.POST("/verification/document/:id", wrapper.VerifyDocument, authmw.RequireRole("SUPER_ADMIN", "ADMIN_KEUANGAN"))
	apiGroup.POST("/verification/realisasi/:id", wrapper.VerifyRealisasiFisik, authmw.RequireRole("SUPER_ADMIN", "ADMIN_KEUANGAN"))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:              fmt.Sprintf(":%s", port),
		Handler:           e,
		ReadHeaderTimeout: envDuration("HTTP_READ_HEADER_TIMEOUT", 10*time.Second),
		ReadTimeout:       envDuration("HTTP_READ_TIMEOUT", 30*time.Second),
		WriteTimeout:      envDuration("HTTP_WRITE_TIMEOUT", 2*time.Minute),
		IdleTimeout:       envDuration("HTTP_IDLE_TIMEOUT", 2*time.Minute),
	}

	go func() {
		if err := e.StartServer(server); err != nil && !errors.Is(err, http.ErrServerClosed) {
			e.Logger.Fatal(err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit
	slog.Info("Gracefully shutting down server...")
	appCancel()

	ctxTimeout, cancelTimeout := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelTimeout()
	if err := e.Shutdown(ctxTimeout); err != nil {
		e.Logger.Fatal(err)
	}
}

func jsonHTTPErrorHandler(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}

	status := http.StatusInternalServerError
	message := "internal server error"

	var he *echo.HTTPError
	if errors.As(err, &he) {
		status = he.Code
		message = messageFromHTTPError(he)
		if message == "" {
			message = http.StatusText(status)
		}
	}

	if status >= 500 {
		slog.Error("request failed", "error", err, "status", status, "path", c.Path(), "method", c.Request().Method)
	}

	_ = c.JSON(status, map[string]string{"message": message})
}

func messageFromHTTPError(he *echo.HTTPError) string {
	if he == nil {
		return ""
	}
	switch m := he.Message.(type) {
	case string:
		return m
	case error:
		return m.Error()
	case map[string]string:
		if v, ok := m["message"]; ok {
			return v
		}
		return ""
	case map[string]any:
		if v, ok := m["message"]; ok {
			if s, ok := v.(string); ok {
				return s
			}
		}
		return ""
	default:
		return ""
	}
}

func envInt32(key string, defaultValue int32) int32 {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return defaultValue
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return defaultValue
	}
	return int32(n)
}

func envDuration(key string, defaultValue time.Duration) time.Duration {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return defaultValue
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return defaultValue
	}
	return d
}
