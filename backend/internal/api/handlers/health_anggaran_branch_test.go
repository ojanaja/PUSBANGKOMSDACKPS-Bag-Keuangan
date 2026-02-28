package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
)

type fakeReadyPool struct {
	pingErr error
}

func (f *fakeReadyPool) Begin(ctx context.Context) (pgx.Tx, error) {
	return nil, errors.New("not implemented")
}

func (f *fakeReadyPool) Ping(ctx context.Context) error {
	return f.pingErr
}

func TestHealthHandlers(t *testing.T) {
	e := echo.New()

	t.Run("GetHealthz", func(t *testing.T) {
		h := &Handler{}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/healthz", nil), rec)

		if err := h.GetHealthz(ctx); err != nil {
			t.Fatalf("GetHealthz returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "UP") {
			t.Fatalf("unexpected payload: %s", rec.Body.String())
		}
	})

	t.Run("GetReadyz up", func(t *testing.T) {
		h := &Handler{pool: &fakeReadyPool{}}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/readyz", nil), rec)

		if err := h.GetReadyz(ctx); err != nil {
			t.Fatalf("GetReadyz returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("GetReadyz down", func(t *testing.T) {
		h := &Handler{pool: &fakeReadyPool{pingErr: errors.New("db down")}}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/readyz", nil), rec)

		if err := h.GetReadyz(ctx); err != nil {
			t.Fatalf("GetReadyz returned error: %v", err)
		}
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})
}

func TestCreateManualAnggaran_FailureBranches(t *testing.T) {
	e := echo.New()
	body := `{"program_kode":"P1","program_uraian":"Program","kegiatan_kode":"K1","kegiatan_uraian":"Kegiatan","output_kode":"O1","output_uraian":"Output","suboutput_kode":"S1","suboutput_uraian":"SubOutput","akun_kode":"A1","akun_uraian":"Akun","pagu":"100","realisasi":"50","sisa":"50","tahun_anggaran":2026}`

	t.Run("invalid request body", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodPost, "/anggaran/manual", strings.NewReader("{"))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.CreateManualAnggaran(ctx)
		if err != nil {
			t.Fatalf("CreateManualAnggaran returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("insert program fails", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			if strings.Contains(sql, "-- name: InsertAnggaranProgram :one") {
				return &handlerFakeRow{err: errors.New("insert program failed")}
			}
			return &handlerFakeRow{err: errors.New("unexpected query row")}
		}}

		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodPost, "/anggaran/manual", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.CreateManualAnggaran(ctx)
		if err != nil {
			t.Fatalf("CreateManualAnggaran returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("insert akun fails", func(t *testing.T) {
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
				return &handlerFakeRow{err: errors.New("insert akun failed")}
			default:
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			}
		}}

		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodPost, "/anggaran/manual", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.CreateManualAnggaran(ctx)
		if err != nil {
			t.Fatalf("CreateManualAnggaran returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("insert kegiatan fails", func(t *testing.T) {
		programID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			switch {
			case strings.Contains(sql, "-- name: InsertAnggaranProgram :one"):
				return &handlerFakeRow{data: []any{programID, "P1", "Program", int32(2026)}}
			case strings.Contains(sql, "-- name: InsertAnggaranKegiatan :one"):
				return &handlerFakeRow{err: errors.New("insert kegiatan failed")}
			default:
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			}
		}}

		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodPost, "/anggaran/manual", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.CreateManualAnggaran(ctx)
		if err != nil {
			t.Fatalf("CreateManualAnggaran returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("insert output fails", func(t *testing.T) {
		programID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
		kegiatanID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			switch {
			case strings.Contains(sql, "-- name: InsertAnggaranProgram :one"):
				return &handlerFakeRow{data: []any{programID, "P1", "Program", int32(2026)}}
			case strings.Contains(sql, "-- name: InsertAnggaranKegiatan :one"):
				return &handlerFakeRow{data: []any{kegiatanID, programID, "K1", "Kegiatan"}}
			case strings.Contains(sql, "-- name: InsertAnggaranOutput :one"):
				return &handlerFakeRow{err: errors.New("insert output failed")}
			default:
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			}
		}}

		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodPost, "/anggaran/manual", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.CreateManualAnggaran(ctx)
		if err != nil {
			t.Fatalf("CreateManualAnggaran returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("insert suboutput fails", func(t *testing.T) {
		programID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
		kegiatanID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
		outputID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			switch {
			case strings.Contains(sql, "-- name: InsertAnggaranProgram :one"):
				return &handlerFakeRow{data: []any{programID, "P1", "Program", int32(2026)}}
			case strings.Contains(sql, "-- name: InsertAnggaranKegiatan :one"):
				return &handlerFakeRow{data: []any{kegiatanID, programID, "K1", "Kegiatan"}}
			case strings.Contains(sql, "-- name: InsertAnggaranOutput :one"):
				return &handlerFakeRow{data: []any{outputID, kegiatanID, "O1", "Output"}}
			case strings.Contains(sql, "-- name: InsertAnggaranSubOutput :one"):
				return &handlerFakeRow{err: errors.New("insert suboutput failed")}
			default:
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			}
		}}

		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodPost, "/anggaran/manual", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.CreateManualAnggaran(ctx)
		if err != nil {
			t.Fatalf("CreateManualAnggaran returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})
}
