package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/services"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
)

type handlerFakeRows struct {
	idx  int
	data [][]any
	err  error
}

func (r *handlerFakeRows) Close()                                       {}
func (r *handlerFakeRows) Err() error                                   { return r.err }
func (r *handlerFakeRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (r *handlerFakeRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (r *handlerFakeRows) Next() bool {
	if r.idx >= len(r.data) {
		return false
	}
	r.idx++
	return true
}
func (r *handlerFakeRows) Scan(dest ...any) error {
	if r.idx == 0 || r.idx > len(r.data) {
		return errors.New("scan called without current row")
	}
	row := r.data[r.idx-1]
	if len(dest) != len(row) {
		return errors.New("destination length mismatch")
	}
	for i := range dest {
		dv := reflect.ValueOf(dest[i])
		if dv.Kind() != reflect.Ptr || dv.IsNil() {
			return errors.New("destination must be non-nil pointer")
		}
		rv := reflect.ValueOf(row[i])
		if !rv.IsValid() {
			dv.Elem().Set(reflect.Zero(dv.Elem().Type()))
			continue
		}
		if !rv.Type().AssignableTo(dv.Elem().Type()) {
			return errors.New("row value type not assignable to destination")
		}
		dv.Elem().Set(rv)
	}
	return nil
}
func (r *handlerFakeRows) Values() ([]any, error) {
	if r.idx == 0 || r.idx > len(r.data) {
		return nil, errors.New("values called without current row")
	}
	return r.data[r.idx-1], nil
}
func (r *handlerFakeRows) RawValues() [][]byte { return nil }
func (r *handlerFakeRows) Conn() *pgx.Conn     { return nil }

type handlerFakeRow struct {
	data []any
	err  error
}

func (r *handlerFakeRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	if len(dest) != len(r.data) {
		return errors.New("destination length mismatch")
	}
	for i := range dest {
		dv := reflect.ValueOf(dest[i])
		if dv.Kind() != reflect.Ptr || dv.IsNil() {
			return errors.New("destination must be non-nil pointer")
		}
		rv := reflect.ValueOf(r.data[i])
		if !rv.IsValid() {
			dv.Elem().Set(reflect.Zero(dv.Elem().Type()))
			continue
		}
		if !rv.Type().AssignableTo(dv.Elem().Type()) {
			return errors.New("row value type not assignable to destination")
		}
		dv.Elem().Set(rv)
	}
	return nil
}

type handlerFakeDBTX struct {
	queryFn    func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
	queryRowFn func(ctx context.Context, sql string, args ...interface{}) pgx.Row
	execFn     func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error)
}

func (f *handlerFakeDBTX) Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
	if f.execFn != nil {
		return f.execFn(ctx, sql, args...)
	}
	return pgconn.CommandTag{}, errors.New("not implemented")
}

func (f *handlerFakeDBTX) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	if f.queryFn == nil {
		return nil, errors.New("queryFn not set")
	}
	return f.queryFn(ctx, sql, args...)
}

func (f *handlerFakeDBTX) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	if f.queryRowFn == nil {
		return &handlerFakeRow{err: errors.New("queryRowFn not set")}
	}
	return f.queryRowFn(ctx, sql, args...)
}

func TestAuthHelpers(t *testing.T) {
	t.Run("cookieSecureEnabled", func(t *testing.T) {
		t.Setenv("COOKIE_SECURE", "")
		if !cookieSecureEnabled() {
			t.Fatalf("expected secure=true by default")
		}
		t.Setenv("COOKIE_SECURE", "false")
		if cookieSecureEnabled() {
			t.Fatalf("expected secure=false")
		}
		t.Setenv("COOKIE_SECURE", "on")
		if !cookieSecureEnabled() {
			t.Fatalf("expected secure=true")
		}
	})

	t.Run("cookieSameSiteMode", func(t *testing.T) {
		t.Setenv("COOKIE_SAME_SITE", "strict")
		if got := cookieSameSiteMode(); got != http.SameSiteStrictMode {
			t.Fatalf("unexpected same-site: %v", got)
		}
		t.Setenv("COOKIE_SAME_SITE", "none")
		if got := cookieSameSiteMode(); got != http.SameSiteNoneMode {
			t.Fatalf("unexpected same-site: %v", got)
		}
		t.Setenv("COOKIE_SAME_SITE", "")
		if got := cookieSameSiteMode(); got != http.SameSiteLaxMode {
			t.Fatalf("unexpected same-site: %v", got)
		}
	})

	t.Run("pgUUIDToString", func(t *testing.T) {
		if got := pgUUIDToString(pgtype.UUID{}); got != "" {
			t.Fatalf("expected empty string for invalid UUID")
		}
		u := uuid.New()
		if got := pgUUIDToString(pgtype.UUID{Bytes: u, Valid: true}); got != u.String() {
			t.Fatalf("unexpected UUID string: got=%q want=%q", got, u.String())
		}
	})
}

func TestAuthLoginValidationAndUnauthorized(t *testing.T) {
	e := echo.New()

	t.Run("invalid payload", func(t *testing.T) {
		h := &AuthHandler{authService: services.NewAuthService("secret")}
		req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader("{"))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.Login(ctx)
		if err != nil {
			t.Fatalf("Login returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("missing username/password", func(t *testing.T) {
		h := &AuthHandler{authService: services.NewAuthService("secret")}
		req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{"username":"","password":""}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.Login(ctx)
		if err != nil {
			t.Fatalf("Login returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("invalid credentials", func(t *testing.T) {
		authService := services.NewAuthService("secret")
		hash, err := authService.HashPassword("right-password")
		if err != nil {
			t.Fatalf("hashing failed: %v", err)
		}

		u := uuid.New()
		fakeDB := &handlerFakeDBTX{
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				if strings.Contains(sql, "-- name: GetUserByUsername :one") {
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: u, Valid: true}, "fauzan", hash, "Fauzan", "SUPER_ADMIN", pgtype.Timestamptz{}, pgtype.Timestamptz{},
					}}
				}
				return &handlerFakeRow{err: errors.New("unexpected query")}
			},
		}

		h := &AuthHandler{authService: authService, queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{"username":"fauzan","password":"wrong-password"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err = h.Login(ctx)
		if err != nil {
			t.Fatalf("Login returned error: %v", err)
		}
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("user lookup error", func(t *testing.T) {
		h := &AuthHandler{
			authService: services.NewAuthService("secret"),
			queries: db.New(&handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				if strings.Contains(sql, "-- name: GetUserByUsername :one") {
					return &handlerFakeRow{err: errors.New("not found")}
				}
				return &handlerFakeRow{err: errors.New("unexpected query")}
			}}),
		}

		req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{"username":"fauzan","password":"any"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.Login(ctx)
		if err != nil {
			t.Fatalf("Login returned error: %v", err)
		}
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})
}

func TestListPaketAndGetPaket(t *testing.T) {
	e := echo.New()
	paketID := uuid.New()

	t.Run("ListPaket success with limit clamp", func(t *testing.T) {
		var captured []interface{}
		fakeDB := &handlerFakeDBTX{
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				if !strings.Contains(sql, "-- name: GetComplianceMatrixPaged :many") {
					return nil, errors.New("unexpected query")
				}
				captured = args
				return &handlerFakeRows{data: [][]any{{
					pgtype.UUID{Bytes: paketID, Valid: true},
					"Paket A",
					float64ToNumeric(1000),
					float64ToNumeric(900),
					float64ToNumeric(500),
					float64ToNumeric(45),
				}}}, nil
			},
		}

		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodGet, "/paket?limit=999&offset=-7", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.ListPaket(ctx, ListPaketParams{})
		if err != nil {
			t.Fatalf("ListPaket returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
		if len(captured) != 3 {
			t.Fatalf("expected 3 query args, got %d", len(captured))
		}
		if captured[1].(int32) != 200 || captured[2].(int32) != 0 {
			t.Fatalf("expected clamped limit=200, offset=0, got limit=%v offset=%v", captured[1], captured[2])
		}

		var got []map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode list payload: %v", err)
		}
		if len(got) != 1 || got[0]["NamaPaket"] != "Paket A" {
			t.Fatalf("unexpected payload: %+v", got)
		}
	})

	t.Run("ListPaket db error", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				return nil, errors.New("db error")
			},
		}
		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodGet, "/paket", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.ListPaket(ctx, ListPaketParams{})
		if err != nil {
			t.Fatalf("ListPaket returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("GetPaket success", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				if strings.Contains(sql, "-- name: GetPaketPekerjaanByID :one") {
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: paketID, Valid: true},
						"Paket Detail",
						"Satker A",
						"Bandung",
						float64ToNumeric(1500),
						"DRAFT",
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.Timestamptz{},
						pgtype.Timestamptz{},
					}}
				}
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			},
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				switch {
				case strings.Contains(sql, "-- name: GetPaketTargetsByPaketID :many"):
					return &handlerFakeRows{data: [][]any{{pgtype.UUID{Bytes: uuid.New(), Valid: true}, pgtype.UUID{Bytes: paketID, Valid: true}, int32(1), float64ToNumeric(20), float64ToNumeric(18)}}}, nil
				case strings.Contains(sql, "-- name: GetRealisasiFisikByPaketID :many"):
					return &handlerFakeRows{data: [][]any{{
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.UUID{Bytes: paketID, Valid: true},
						int32(1),
						float64ToNumeric(17),
						pgtype.Text{String: "kendala", Valid: true},
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.Timestamptz{},
						pgtype.Text{String: "APPROVED", Valid: true},
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.Timestamptz{},
						pgtype.Text{},
						pgtype.Text{String: "Verifier", Valid: true},
					}}}, nil
				default:
					return nil, errors.New("unexpected query")
				}
			},
		}

		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodGet, "/paket/1", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.GetPaket(ctx, paketID)
		if err != nil {
			t.Fatalf("GetPaket returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "Paket Detail") {
			t.Fatalf("unexpected body: %s", rec.Body.String())
		}
	})

	t.Run("GetPaket not found", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				return &handlerFakeRow{err: errors.New("not found")}
			},
		}
		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodGet, "/paket/1", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.GetPaket(ctx, paketID)
		if err != nil {
			t.Fatalf("GetPaket returned error: %v", err)
		}
		if rec.Code != http.StatusNotFound {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})
}

func TestMeUnauthorized(t *testing.T) {
	e := echo.New()
	h := &AuthHandler{authService: services.NewAuthService("secret")}
	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	err := h.Me(ctx)
	if err != nil {
		t.Fatalf("Me returned error: %v", err)
	}
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unexpected status: %d", rec.Code)
	}
}
