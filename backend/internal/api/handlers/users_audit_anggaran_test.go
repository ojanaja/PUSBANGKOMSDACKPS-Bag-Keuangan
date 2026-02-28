package handlers

import (
	"context"
	"errors"
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

func TestUsersHandler_ListUsers(t *testing.T) {
	e := echo.New()
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				if !strings.Contains(sql, "-- name: ListUsers :many") {
					return nil, errors.New("unexpected query")
				}
				return &handlerFakeRows{data: [][]any{{
					pgtype.UUID{Bytes: userID, Valid: true},
					"fauzan",
					"Fauzan",
					"SUPER_ADMIN",
					pgtype.Timestamptz{Time: time.Now(), Valid: true},
					pgtype.Timestamptz{},
				}}}, nil
			},
		}

		h := &Handler{queries: db.New(fakeDB)}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/users", nil), rec)

		err := h.ListUsers(ctx)
		if err != nil {
			t.Fatalf("ListUsers returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "fauzan") {
			t.Fatalf("unexpected payload: %s", rec.Body.String())
		}
	})

	t.Run("db error", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			return nil, errors.New("db error")
		}}
		h := &Handler{queries: db.New(fakeDB)}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/users", nil), rec)

		err := h.ListUsers(ctx)
		if err != nil {
			t.Fatalf("ListUsers returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})
}

func TestUsersHandler_CreateUserAndUpdateUser(t *testing.T) {
	e := echo.New()
	adminID := uuid.New()
	newUserID := uuid.New()

	t.Run("create user unauthorized", func(t *testing.T) {
		h := &Handler{auth: services.NewAuthService("secret")}
		req := httptest.NewRequest(http.MethodPost, "/users", strings.NewReader(`{"username":"u","password":"p","full_name":"n","role":"PPK"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.CreateUser(ctx)
		if err != nil {
			t.Fatalf("CreateUser returned error: %v", err)
		}
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("create user invalid body", func(t *testing.T) {
		h := &Handler{auth: services.NewAuthService("secret")}
		req := httptest.NewRequest(http.MethodPost, "/users", strings.NewReader("{"))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: adminID.String(), Role: "SUPER_ADMIN"})

		err := h.CreateUser(ctx)
		if err != nil {
			t.Fatalf("CreateUser returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("create user success", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				switch {
				case strings.Contains(sql, "-- name: CreateUser :one"):
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: newUserID, Valid: true},
						"newuser",
						"hashed",
						"New User",
						"PPK",
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Timestamptz{},
					}}
				case strings.Contains(sql, "-- name: CreateActivityLog :one"):
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.UUID{Bytes: adminID, Valid: true},
						"CREATE_USER",
						pgtype.Text{String: "user", Valid: true},
						pgtype.UUID{Bytes: newUserID, Valid: true},
						[]byte(`{"username":"newuser"}`),
						pgtype.Text{String: "127.0.0.1", Valid: true},
						pgtype.Text{String: "ua", Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
					}}
				default:
					return &handlerFakeRow{err: errors.New("unexpected query row")}
				}
			},
		}

		h := &Handler{
			auth:     services.NewAuthService("secret"),
			queries:  db.New(fakeDB),
			activity: services.NewActivityLogger(db.New(fakeDB)),
		}

		req := httptest.NewRequest(http.MethodPost, "/users", strings.NewReader(`{"username":"newuser","password":"secret123","full_name":"New User","role":"PPK"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: adminID.String(), Role: "SUPER_ADMIN"})

		err := h.CreateUser(ctx)
		if err != nil {
			t.Fatalf("CreateUser returned error: %v", err)
		}
		if rec.Code != http.StatusCreated {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
		if !strings.Contains(rec.Body.String(), "newuser") {
			t.Fatalf("unexpected payload: %s", rec.Body.String())
		}
	})

	t.Run("create user db error", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				if strings.Contains(sql, "-- name: CreateUser :one") {
					return &handlerFakeRow{err: errors.New("create failed")}
				}
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			},
		}

		h := &Handler{
			auth:    services.NewAuthService("secret"),
			queries: db.New(fakeDB),
		}

		req := httptest.NewRequest(http.MethodPost, "/users", strings.NewReader(`{"username":"newuser","password":"secret123","full_name":"New User","role":"PPK"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: adminID.String(), Role: "SUPER_ADMIN"})

		err := h.CreateUser(ctx)
		if err != nil {
			t.Fatalf("CreateUser returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("create user hash failure", func(t *testing.T) {
		h := &Handler{auth: services.NewAuthService("secret")}
		longPassword := strings.Repeat("x", 100)
		req := httptest.NewRequest(http.MethodPost, "/users", strings.NewReader(`{"username":"newuser","password":"`+longPassword+`","full_name":"New User","role":"PPK"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: adminID.String(), Role: "SUPER_ADMIN"})

		err := h.CreateUser(ctx)
		if err != nil {
			t.Fatalf("CreateUser returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("update user not found", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			if strings.Contains(sql, "-- name: GetUser :one") {
				return &handlerFakeRow{err: errors.New("not found")}
			}
			return &handlerFakeRow{err: errors.New("unexpected query")}
		}}
		h := &Handler{auth: services.NewAuthService("secret"), queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodPatch, "/users", strings.NewReader(`{"full_name":"X"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: adminID.String(), Role: "SUPER_ADMIN"})

		err := h.UpdateUser(ctx, newUserID)
		if err != nil {
			t.Fatalf("UpdateUser returned error: %v", err)
		}
		if rec.Code != http.StatusNotFound {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("update user unauthorized", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodPatch, "/users", strings.NewReader(`{"full_name":"X"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.UpdateUser(ctx, newUserID)
		if err != nil {
			t.Fatalf("UpdateUser returned error: %v", err)
		}
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("update user invalid body", func(t *testing.T) {
		h := &Handler{auth: services.NewAuthService("secret")}
		req := httptest.NewRequest(http.MethodPatch, "/users", strings.NewReader("{"))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: adminID.String(), Role: "SUPER_ADMIN"})

		err := h.UpdateUser(ctx, newUserID)
		if err != nil {
			t.Fatalf("UpdateUser returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("update user success", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				switch {
				case strings.Contains(sql, "-- name: GetUser :one"):
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: newUserID, Valid: true},
						"olduser",
						"oldhash",
						"Old Name",
						"PPK",
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Timestamptz{},
					}}
				case strings.Contains(sql, "-- name: UpdateUser :one"):
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: newUserID, Valid: true},
						"olduser",
						"newhash",
						"New Name",
						"SUPER_ADMIN",
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Timestamptz{},
					}}
				case strings.Contains(sql, "-- name: CreateActivityLog :one"):
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.UUID{Bytes: adminID, Valid: true},
						"UPDATE_USER",
						pgtype.Text{String: "user", Valid: true},
						pgtype.UUID{Bytes: newUserID, Valid: true},
						[]byte(`{"username":"olduser"}`),
						pgtype.Text{},
						pgtype.Text{},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
					}}
				default:
					return &handlerFakeRow{err: errors.New("unexpected query row")}
				}
			},
		}

		h := &Handler{auth: services.NewAuthService("secret"), queries: db.New(fakeDB), activity: services.NewActivityLogger(db.New(fakeDB))}
		req := httptest.NewRequest(http.MethodPatch, "/users", strings.NewReader(`{"full_name":"New Name","role":"SUPER_ADMIN","password":"new-pass"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: adminID.String(), Role: "SUPER_ADMIN"})

		err := h.UpdateUser(ctx, newUserID)
		if err != nil {
			t.Fatalf("UpdateUser returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
		if !strings.Contains(rec.Body.String(), "New Name") {
			t.Fatalf("unexpected response payload: %s", rec.Body.String())
		}
	})

	t.Run("update user update-failure", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				switch {
				case strings.Contains(sql, "-- name: GetUser :one"):
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: newUserID, Valid: true},
						"olduser",
						"oldhash",
						"Old Name",
						"PPK",
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Timestamptz{},
					}}
				case strings.Contains(sql, "-- name: UpdateUser :one"):
					return &handlerFakeRow{err: errors.New("update failed")}
				default:
					return &handlerFakeRow{err: errors.New("unexpected query row")}
				}
			},
		}

		h := &Handler{auth: services.NewAuthService("secret"), queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodPatch, "/users", strings.NewReader(`{"full_name":"New Name"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: adminID.String(), Role: "SUPER_ADMIN"})

		err := h.UpdateUser(ctx, newUserID)
		if err != nil {
			t.Fatalf("UpdateUser returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("update user hash failure", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			if strings.Contains(sql, "-- name: GetUser :one") {
				return &handlerFakeRow{data: []any{
					pgtype.UUID{Bytes: newUserID, Valid: true},
					"olduser",
					"oldhash",
					"Old Name",
					"PPK",
					pgtype.Timestamptz{Time: time.Now(), Valid: true},
					pgtype.Timestamptz{},
				}}
			}
			return &handlerFakeRow{err: errors.New("unexpected query row")}
		}}

		h := &Handler{auth: services.NewAuthService("secret"), queries: db.New(fakeDB)}
		longPassword := strings.Repeat("x", 100)
		req := httptest.NewRequest(http.MethodPatch, "/users", strings.NewReader(`{"password":"`+longPassword+`"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: adminID.String(), Role: "SUPER_ADMIN"})

		err := h.UpdateUser(ctx, newUserID)
		if err != nil {
			t.Fatalf("UpdateUser returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("delete user unauthorized", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodDelete, "/users", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.DeleteUser(ctx, newUserID)
		if err != nil {
			t.Fatalf("DeleteUser returned error: %v", err)
		}
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("delete user db error", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{execFn: func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
			return pgconn.CommandTag{}, errors.New("db error")
		}}
		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodDelete, "/users", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: adminID.String(), Role: "SUPER_ADMIN"})

		err := h.DeleteUser(ctx, newUserID)
		if err != nil {
			t.Fatalf("DeleteUser returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("delete user success", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			execFn: func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
				if !strings.Contains(sql, "-- name: DeleteUser :exec") {
					return pgconn.CommandTag{}, errors.New("unexpected exec")
				}
				return pgconn.NewCommandTag("DELETE 1"), nil
			},
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				if strings.Contains(sql, "-- name: CreateActivityLog :one") {
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.UUID{Bytes: adminID, Valid: true},
						"DELETE_USER",
						pgtype.Text{String: "user", Valid: true},
						pgtype.UUID{Bytes: newUserID, Valid: true},
						nil,
						pgtype.Text{},
						pgtype.Text{},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
					}}
				}
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			},
		}
		h := &Handler{queries: db.New(fakeDB), activity: services.NewActivityLogger(db.New(fakeDB))}
		req := httptest.NewRequest(http.MethodDelete, "/users", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: adminID.String(), Role: "SUPER_ADMIN"})

		err := h.DeleteUser(ctx, newUserID)
		if err != nil {
			t.Fatalf("DeleteUser returned error: %v", err)
		}
		if rec.Code != http.StatusNoContent {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})
}

func TestAuditAndAnggaranHandlers(t *testing.T) {
	e := echo.New()
	userID := uuid.New()
	targetID := uuid.New()

	t.Run("ListAuditLogs success", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				if !strings.Contains(sql, "-- name: ListActivityLogs :many") {
					return nil, errors.New("unexpected query")
				}
				return &handlerFakeRows{data: [][]any{{
					pgtype.UUID{Bytes: uuid.New(), Valid: true},
					pgtype.UUID{Bytes: userID, Valid: true},
					"UPDATE_PAKET",
					pgtype.Text{String: "paket", Valid: true},
					pgtype.UUID{Bytes: targetID, Valid: true},
					[]byte(`{"k":"v"}`),
					pgtype.Text{String: "127.0.0.1", Valid: true},
					pgtype.Text{String: "ua", Valid: true},
					pgtype.Timestamptz{Time: time.Now(), Valid: true},
					"Fauzan",
					"fauzan",
				}}}, nil
			},
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				if strings.Contains(sql, "-- name: CountActivityLogs :one") {
					return &handlerFakeRow{data: []any{int64(10)}}
				}
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			},
		}

		h := &Handler{queries: db.New(fakeDB)}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/audit", nil), rec)

		err := h.ListAuditLogs(ctx, ListAuditLogsParams{})
		if err != nil {
			t.Fatalf("ListAuditLogs returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "UPDATE_PAKET") {
			t.Fatalf("unexpected payload: %s", rec.Body.String())
		}
	})

	t.Run("ListAuditLogs db error", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			return nil, errors.New("db error")
		}}
		h := &Handler{queries: db.New(fakeDB)}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/audit", nil), rec)

		err := h.ListAuditLogs(ctx, ListAuditLogsParams{})
		if err != nil {
			t.Fatalf("ListAuditLogs returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("ListAuditLogs with limit and offset params", func(t *testing.T) {
		limit := 10
		offset := 5
		fakeDB := &handlerFakeDBTX{
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				if !strings.Contains(sql, "-- name: ListActivityLogs :many") {
					return nil, errors.New("unexpected query")
				}
				if len(args) != 2 || args[0] != int32(limit) || args[1] != int32(offset) {
					return nil, errors.New("unexpected pagination args")
				}
				return &handlerFakeRows{data: [][]any{}}, nil
			},
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				return &handlerFakeRow{data: []any{int64(0)}}
			},
		}

		h := &Handler{queries: db.New(fakeDB)}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/audit", nil), rec)

		err := h.ListAuditLogs(ctx, ListAuditLogsParams{Limit: &limit, Offset: &offset})
		if err != nil {
			t.Fatalf("ListAuditLogs returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("GetAnggaranTree success and error", func(t *testing.T) {
		fakeOK := &handlerFakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			if !strings.Contains(sql, "-- name: GetAnggaranTree :many") {
				return nil, errors.New("unexpected query")
			}
			return &handlerFakeRows{data: [][]any{{
				pgtype.UUID{Bytes: uuid.New(), Valid: true}, "P1", "Program",
				pgtype.UUID{Bytes: uuid.New(), Valid: true}, "K1", "Kegiatan",
				pgtype.UUID{Bytes: uuid.New(), Valid: true}, "O1", "Output",
				pgtype.UUID{Bytes: uuid.New(), Valid: true}, "S1", "Sub",
				pgtype.UUID{Bytes: uuid.New(), Valid: true}, "A1", "Akun",
				float64ToNumeric(100), float64ToNumeric(50), float64ToNumeric(50),
			}}}, nil
		}}
		hOK := &Handler{queries: db.New(fakeOK)}
		rec1 := httptest.NewRecorder()
		ctx1 := e.NewContext(httptest.NewRequest(http.MethodGet, "/anggaran", nil), rec1)
		if err := hOK.GetAnggaranTree(ctx1, GetAnggaranTreeParams{Tahun: 2026}); err != nil {
			t.Fatalf("GetAnggaranTree returned error: %v", err)
		}
		if rec1.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec1.Code)
		}

		fakeErr := &handlerFakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			return nil, errors.New("db error")
		}}
		hErr := &Handler{queries: db.New(fakeErr)}
		rec2 := httptest.NewRecorder()
		ctx2 := e.NewContext(httptest.NewRequest(http.MethodGet, "/anggaran", nil), rec2)
		if err := hErr.GetAnggaranTree(ctx2, GetAnggaranTreeParams{Tahun: 2026}); err != nil {
			t.Fatalf("GetAnggaranTree returned error: %v", err)
		}
		if rec2.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec2.Code)
		}
	})

	t.Run("CreateManualAnggaran success", func(t *testing.T) {
		programID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
		kegiatanID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
		outputID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
		subOutputID := pgtype.UUID{Bytes: uuid.New(), Valid: true}

		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			switch {
			case strings.Contains(sql, "-- name: InsertAnggaranProgram :one"):
				return &handlerFakeRow{data: []any{programID, "P1", "Program", int32(2026)}}
			case strings.Contains(sql, "-- name: InsertAnggaranKegiatan :one"):
				return &handlerFakeRow{data: []any{kegiatanID, programID, "K1", "Kegiatan"}}
			case strings.Contains(sql, "-- name: InsertAnggaranOutput :one"):
				return &handlerFakeRow{data: []any{outputID, kegiatanID, "O1", "Output"}}
			case strings.Contains(sql, "-- name: InsertAnggaranSubOutput :one"):
				return &handlerFakeRow{data: []any{subOutputID, outputID, "S1", "SubOutput"}}
			case strings.Contains(sql, "-- name: InsertAnggaranAkun :one"):
				return &handlerFakeRow{data: []any{pgtype.UUID{Bytes: uuid.New(), Valid: true}, subOutputID, "A1", "Akun", float64ToNumeric(100), float64ToNumeric(50), float64ToNumeric(50)}}
			default:
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			}
		}}

		h := &Handler{queries: db.New(fakeDB)}
		body := `{"program_kode":"P1","program_uraian":"Program","kegiatan_kode":"K1","kegiatan_uraian":"Kegiatan","output_kode":"O1","output_uraian":"Output","suboutput_kode":"S1","suboutput_uraian":"SubOutput","akun_kode":"A1","akun_uraian":"Akun","pagu":"100","realisasi":"50","sisa":"50","tahun_anggaran":2026}`
		req := httptest.NewRequest(http.MethodPost, "/anggaran/manual", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.CreateManualAnggaran(ctx)
		if err != nil {
			t.Fatalf("CreateManualAnggaran returned error: %v", err)
		}
		if rec.Code != http.StatusCreated {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})
}

func TestMustDecimalNumeric(t *testing.T) {
	good := mustDecimalNumeric("123.45")
	if got := numericToDecimalString(good); got != "123.45" {
		t.Fatalf("unexpected decimal value: %s", got)
	}

	bad := mustDecimalNumeric("not-a-number")
	if got := numericToDecimalString(bad); got != "0" {
		t.Fatalf("invalid decimal should fallback to 0, got %s", got)
	}
}

func TestAuditListResponseIsJSON(t *testing.T) {
	fakeDB := &handlerFakeDBTX{
		queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			return &handlerFakeRows{data: [][]any{}}, nil
		},
		queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			return &handlerFakeRow{data: []any{int64(0)}}
		},
	}
	h := &Handler{queries: db.New(fakeDB)}
	e := echo.New()
	rec := httptest.NewRecorder()
	ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/audit", nil), rec)

	if err := h.ListAuditLogs(ctx, ListAuditLogsParams{}); err != nil {
		t.Fatalf("ListAuditLogs returned error: %v", err)
	}
}
