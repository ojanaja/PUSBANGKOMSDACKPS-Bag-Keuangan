package handlers

import (
	"bytes"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	authmw "github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/api/middleware"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/services"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
)

type fakeExecPool struct {
	execFn func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error)
}

func (f *fakeExecPool) Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
	if f.execFn != nil {
		return f.execFn(ctx, sql, args...)
	}
	return pgconn.CommandTag{}, nil
}

type fakeBeginPool struct {
	beginFn func(ctx context.Context) (pgx.Tx, error)
}

func (f *fakeBeginPool) Begin(ctx context.Context) (pgx.Tx, error) {
	if f.beginFn != nil {
		return f.beginFn(ctx)
	}
	return nil, errors.New("beginFn not set")
}

func (f *fakeBeginPool) Ping(ctx context.Context) error {
	return nil
}

func TestAuth_LoginSuccess_Me_Logout(t *testing.T) {
	e := echo.New()
	userID := uuid.New()
	secret := "secret"
	authSvc := services.NewAuthService(secret)
	hashed, err := authSvc.HashPassword("correct-password")
	if err != nil {
		t.Fatalf("hashing failed: %v", err)
	}

	fakeDB := &handlerFakeDBTX{
		queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			switch {
			case strings.Contains(sql, "-- name: GetUserByUsername :one"):
				return &handlerFakeRow{data: []any{
					pgtype.UUID{Bytes: userID, Valid: true},
					"fauzan",
					hashed,
					"Fauzan",
					"SUPER_ADMIN",
					pgtype.Timestamptz{Time: time.Now(), Valid: true},
					pgtype.Timestamptz{Time: time.Now(), Valid: true},
				}}
			case strings.Contains(sql, "-- name: GetUser :one"):
				return &handlerFakeRow{data: []any{
					pgtype.UUID{Bytes: userID, Valid: true},
					"fauzan",
					hashed,
					"Fauzan",
					"SUPER_ADMIN",
					pgtype.Timestamptz{Time: time.Now(), Valid: true},
					pgtype.Timestamptz{Time: time.Now(), Valid: true},
				}}
			case strings.Contains(sql, "-- name: CreateActivityLog :one"):
				return &handlerFakeRow{data: []any{
					pgtype.UUID{Bytes: uuid.New(), Valid: true},
					pgtype.UUID{Bytes: userID, Valid: true},
					"ACTION",
					pgtype.Text{String: "USER", Valid: true},
					pgtype.UUID{Bytes: userID, Valid: true},
					nil,
					pgtype.Text{String: "127.0.0.1", Valid: true},
					pgtype.Text{String: "ua", Valid: true},
					pgtype.Timestamptz{Time: time.Now(), Valid: true},
				}}
			default:
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			}
		},
	}

	authHandler := &AuthHandler{
		authService: authSvc,
		queries:     db.New(fakeDB),
		activity:    services.NewActivityLogger(db.New(fakeDB)),
	}

	t.Run("Login success sets cookie", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{"username":"fauzan","password":"correct-password"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := authHandler.Login(ctx)
		if err != nil {
			t.Fatalf("Login returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
		if !strings.Contains(rec.Header().Get(echo.HeaderSetCookie), "session=") {
			t.Fatalf("expected session cookie in response")
		}
	})

	t.Run("Me invalid user id in claims", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/me", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: "not-a-uuid", Role: "SUPER_ADMIN"})

		err := authHandler.Me(ctx)
		if err != nil {
			t.Fatalf("Me returned error: %v", err)
		}
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("Me success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/me", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "SUPER_ADMIN"})

		err := authHandler.Me(ctx)
		if err != nil {
			t.Fatalf("Me returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "fauzan") {
			t.Fatalf("unexpected body: %s", rec.Body.String())
		}
	})

	t.Run("Me user not found", func(t *testing.T) {
		fakeNotFound := &handlerFakeDBTX{
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				switch {
				case strings.Contains(sql, "-- name: GetUser :one"):
					return &handlerFakeRow{err: errors.New("not found")}
				default:
					return &handlerFakeRow{err: errors.New("unexpected query row")}
				}
			},
		}
		hNotFound := &AuthHandler{authService: authSvc, queries: db.New(fakeNotFound)}

		req := httptest.NewRequest(http.MethodGet, "/me", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "SUPER_ADMIN"})

		err := hNotFound.Me(ctx)
		if err != nil {
			t.Fatalf("Me returned error: %v", err)
		}
		if rec.Code != http.StatusNotFound {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("Logout success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/logout", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "SUPER_ADMIN"})

		err := authHandler.Logout(ctx)
		if err != nil {
			t.Fatalf("Logout returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
		if !strings.Contains(rec.Header().Get(echo.HeaderSetCookie), "session=") {
			t.Fatalf("expected session clear cookie")
		}
	})

	t.Run("Logout revocation insert failure", func(t *testing.T) {
		token, err := authSvc.GenerateToken(userID.String(), "fauzan", "SUPER_ADMIN")
		if err != nil {
			t.Fatalf("GenerateToken error: %v", err)
		}

		h := &AuthHandler{
			authService: authSvc,
			queries:     db.New(fakeDB),
			activity:    services.NewActivityLogger(db.New(fakeDB)),
			pool: &fakeExecPool{execFn: func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
				if strings.Contains(sql, "INSERT INTO revoked_tokens") {
					return pgconn.CommandTag{}, errors.New("insert failed")
				}
				return pgconn.NewCommandTag("DELETE 0"), nil
			}},
		}

		req := httptest.NewRequest(http.MethodPost, "/logout", nil)
		req.AddCookie(&http.Cookie{Name: "session", Value: token})
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err = h.Logout(ctx)
		if err != nil {
			t.Fatalf("Logout returned error: %v", err)
		}
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("Logout revocation success", func(t *testing.T) {
		token, err := authSvc.GenerateToken(userID.String(), "fauzan", "SUPER_ADMIN")
		if err != nil {
			t.Fatalf("GenerateToken error: %v", err)
		}
		calls := make([]string, 0, 2)

		h := &AuthHandler{
			authService: authSvc,
			queries:     db.New(fakeDB),
			activity:    services.NewActivityLogger(db.New(fakeDB)),
			pool: &fakeExecPool{execFn: func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
				calls = append(calls, sql)
				if strings.Contains(sql, "INSERT INTO revoked_tokens") {
					return pgconn.NewCommandTag("INSERT 1"), nil
				}
				return pgconn.NewCommandTag("DELETE 0"), nil
			}},
		}

		req := httptest.NewRequest(http.MethodPost, "/logout", nil)
		req.AddCookie(&http.Cookie{Name: "session", Value: token})
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err = h.Logout(ctx)
		if err != nil {
			t.Fatalf("Logout returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
		if len(calls) < 2 {
			t.Fatalf("expected revoke insert and cleanup delete calls, got %d", len(calls))
		}
		if !strings.Contains(calls[0], "INSERT INTO revoked_tokens") || !strings.Contains(calls[1], "DELETE FROM revoked_tokens") {
			t.Fatalf("unexpected exec sequence: %#v", calls)
		}
	})
}

func TestImportAnggaranData_ValidationErrors(t *testing.T) {
	e := echo.New()
	h := &Handler{}

	t.Run("missing file", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/anggaran/import", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.ImportAnggaranData(ctx)
		if err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("invalid tahun_anggaran", func(t *testing.T) {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)

		fw, err := writer.CreateFormFile("file", "anggaran.csv")
		if err != nil {
			t.Fatalf("CreateFormFile error: %v", err)
		}
		_, _ = fw.Write([]byte("programkode,programuraian\nP1,Program 1\n"))
		_ = writer.WriteField("tahun_anggaran", "abc")
		if err := writer.Close(); err != nil {
			t.Fatalf("writer.Close error: %v", err)
		}

		req := httptest.NewRequest(http.MethodPost, "/anggaran/import", &body)
		req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err = h.ImportAnggaranData(ctx)
		if err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("begin transaction failure", func(t *testing.T) {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)

		fw, err := writer.CreateFormFile("file", "anggaran.csv")
		if err != nil {
			t.Fatalf("CreateFormFile error: %v", err)
		}
		_, _ = fw.Write([]byte("programkode,programuraian\nP1,Program 1\n"))
		_ = writer.WriteField("tahun_anggaran", "2026")
		if err := writer.Close(); err != nil {
			t.Fatalf("writer.Close error: %v", err)
		}

		hPool := &Handler{pool: &fakeBeginPool{beginFn: func(ctx context.Context) (pgx.Tx, error) {
			return nil, errors.New("begin failed")
		}}}

		req := httptest.NewRequest(http.MethodPost, "/anggaran/import", &body)
		req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err = hPool.ImportAnggaranData(ctx)
		if err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})
}
