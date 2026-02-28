package handlers

import (
	"context"
	"encoding/json"
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

func TestPaketMutations_UpdateDelete(t *testing.T) {
	e := echo.New()
	paketID := uuid.New()
	userID := uuid.New()

	t.Run("CreatePaket begin tx failure", func(t *testing.T) {
		h := &Handler{pool: &fakeBeginPool{beginFn: func(ctx context.Context) (pgx.Tx, error) {
			return nil, errors.New("begin failed")
		}}}
		req := httptest.NewRequest(http.MethodPost, "/paket", strings.NewReader(`{"nama_paket":"A","kasatker":"B","lokasi":"C","pagu_paket":"100"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PPK"})

		err := h.CreatePaket(ctx)
		if err != nil {
			t.Fatalf("CreatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("CreatePaket invalid pagu", func(t *testing.T) {
		tx := &fakeImportTx{}
		h := &Handler{queries: db.New(&handlerFakeDBTX{}), pool: &fakeBeginPool{beginFn: func(ctx context.Context) (pgx.Tx, error) {
			return tx, nil
		}}}
		req := httptest.NewRequest(http.MethodPost, "/paket", strings.NewReader(`{"nama_paket":"A","kasatker":"B","lokasi":"C","pagu_paket":"not-a-number"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PPK"})

		err := h.CreatePaket(ctx)
		if err != nil {
			t.Fatalf("CreatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("CreatePaket success with akun and targets", func(t *testing.T) {
		createdPaketID := uuid.New()
		targetID := uuid.New()
		activityID := uuid.New()
		akunID := uuid.New()

		tx := &fakeImportTx{
			execFn: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				if strings.Contains(sql, "-- name: InsertPaketAkunMapping :exec") {
					return pgconn.NewCommandTag("INSERT 1"), nil
				}
				return pgconn.NewCommandTag("OK"), nil
			},
			queryRowFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
				switch {
				case strings.Contains(sql, "-- name: InsertPaketPekerjaan :one"):
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: createdPaketID, Valid: true},
						"Paket Baru",
						"Satker",
						"Lokasi",
						float64ToNumeric(1200),
						"DRAFT",
						pgtype.UUID{Bytes: userID, Valid: true},
						pgtype.Timestamptz{},
						pgtype.Timestamptz{},
					}}
				case strings.Contains(sql, "-- name: InsertPaketTarget :one"):
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: targetID, Valid: true},
						pgtype.UUID{Bytes: createdPaketID, Valid: true},
						int32(1),
						float64ToNumeric(10),
						float64ToNumeric(8),
					}}
				case strings.Contains(sql, "-- name: CreateActivityLog :one"):
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: activityID, Valid: true},
						pgtype.UUID{Bytes: userID, Valid: true},
						"CREATE_PAKET",
						pgtype.Text{String: "paket", Valid: true},
						pgtype.UUID{Bytes: createdPaketID, Valid: true},
						[]byte(`{"nama":"Paket Baru"}`),
						pgtype.Text{}, pgtype.Text{}, pgtype.Timestamptz{},
					}}
				default:
					return &handlerFakeRow{err: errors.New("unexpected query row")}
				}
			},
		}

		h := &Handler{
			queries:  db.New(tx),
			pool:     &fakeBeginPool{beginFn: func(ctx context.Context) (pgx.Tx, error) { return tx, nil }},
			activity: services.NewActivityLogger(db.New(tx)),
		}

		body := `{"nama_paket":"Paket Baru","kasatker":"Satker","lokasi":"Lokasi","pagu_paket":"1200","akun_ids":["` + akunID.String() + `"],"targets":[{"bulan":1,"persen_keuangan":10,"persen_fisik":8},{"persen_keuangan":20}]}`
		req := httptest.NewRequest(http.MethodPost, "/paket", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PPK"})

		err := h.CreatePaket(ctx)
		if err != nil {
			t.Fatalf("CreatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusCreated {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}

		var payload map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if payload["nama_paket"] != "Paket Baru" {
			t.Fatalf("unexpected paket payload: %+v", payload)
		}
	})

	t.Run("CreatePaket commit failure", func(t *testing.T) {
		createdPaketID := uuid.New()
		tx := &fakeImportTx{
			commitErr: errors.New("commit failed"),
			queryRowFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
				if strings.Contains(sql, "-- name: InsertPaketPekerjaan :one") {
					return &handlerFakeRow{data: []any{pgtype.UUID{Bytes: createdPaketID, Valid: true}, "Paket", "Sat", "Lok", float64ToNumeric(100), "DRAFT", pgtype.UUID{Bytes: userID, Valid: true}, pgtype.Timestamptz{}, pgtype.Timestamptz{}}}
				}
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			},
		}
		h := &Handler{queries: db.New(tx), pool: &fakeBeginPool{beginFn: func(ctx context.Context) (pgx.Tx, error) { return tx, nil }}}
		req := httptest.NewRequest(http.MethodPost, "/paket", strings.NewReader(`{"nama_paket":"A","kasatker":"B","lokasi":"C","pagu_paket":"100"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PPK"})

		err := h.CreatePaket(ctx)
		if err != nil {
			t.Fatalf("CreatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("CreatePaket insert paket failure", func(t *testing.T) {
		tx := &fakeImportTx{queryRowFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
			if strings.Contains(sql, "-- name: InsertPaketPekerjaan :one") {
				return &handlerFakeRow{err: errors.New("insert paket failed")}
			}
			return &handlerFakeRow{err: errors.New("unexpected query row")}
		}}
		h := &Handler{queries: db.New(tx), pool: &fakeBeginPool{beginFn: func(ctx context.Context) (pgx.Tx, error) { return tx, nil }}}
		req := httptest.NewRequest(http.MethodPost, "/paket", strings.NewReader(`{"nama_paket":"A","kasatker":"B","lokasi":"C","pagu_paket":"100"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PPK"})

		err := h.CreatePaket(ctx)
		if err != nil {
			t.Fatalf("CreatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("CreatePaket mapping failure", func(t *testing.T) {
		createdPaketID := uuid.New()
		akunID := uuid.New()
		tx := &fakeImportTx{
			execFn: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				if strings.Contains(sql, "-- name: InsertPaketAkunMapping :exec") {
					return pgconn.CommandTag{}, errors.New("mapping failed")
				}
				return pgconn.NewCommandTag("OK"), nil
			},
			queryRowFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
				if strings.Contains(sql, "-- name: InsertPaketPekerjaan :one") {
					return &handlerFakeRow{data: []any{pgtype.UUID{Bytes: createdPaketID, Valid: true}, "Paket", "Sat", "Lok", float64ToNumeric(100), "DRAFT", pgtype.UUID{Bytes: userID, Valid: true}, pgtype.Timestamptz{}, pgtype.Timestamptz{}}}
				}
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			},
		}
		h := &Handler{queries: db.New(tx), pool: &fakeBeginPool{beginFn: func(ctx context.Context) (pgx.Tx, error) { return tx, nil }}}
		body := `{"nama_paket":"A","kasatker":"B","lokasi":"C","pagu_paket":"100","akun_ids":["` + akunID.String() + `"]}`
		req := httptest.NewRequest(http.MethodPost, "/paket", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PPK"})

		err := h.CreatePaket(ctx)
		if err != nil {
			t.Fatalf("CreatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("CreatePaket target failure", func(t *testing.T) {
		createdPaketID := uuid.New()
		tx := &fakeImportTx{queryRowFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
			switch {
			case strings.Contains(sql, "-- name: InsertPaketPekerjaan :one"):
				return &handlerFakeRow{data: []any{pgtype.UUID{Bytes: createdPaketID, Valid: true}, "Paket", "Sat", "Lok", float64ToNumeric(100), "DRAFT", pgtype.UUID{Bytes: userID, Valid: true}, pgtype.Timestamptz{}, pgtype.Timestamptz{}}}
			case strings.Contains(sql, "-- name: InsertPaketTarget :one"):
				return &handlerFakeRow{err: errors.New("target failed")}
			default:
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			}
		}}
		h := &Handler{queries: db.New(tx), pool: &fakeBeginPool{beginFn: func(ctx context.Context) (pgx.Tx, error) { return tx, nil }}}
		req := httptest.NewRequest(http.MethodPost, "/paket", strings.NewReader(`{"nama_paket":"A","kasatker":"B","lokasi":"C","pagu_paket":"100","targets":[{"bulan":1,"persen_keuangan":10,"persen_fisik":8}]}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PPK"})

		err := h.CreatePaket(ctx)
		if err != nil {
			t.Fatalf("CreatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("CreatePaket invalid body", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodPost, "/paket", strings.NewReader("{"))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.CreatePaket(ctx)
		if err != nil {
			t.Fatalf("CreatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("CreatePaket unauthorized", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodPost, "/paket", strings.NewReader(`{"nama_paket":"A"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.CreatePaket(ctx)
		if err != nil {
			t.Fatalf("CreatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("CreatePaket invalid user id in claims", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodPost, "/paket", strings.NewReader(`{"nama_paket":"A"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: "not-a-uuid", Role: "PPK"})

		err := h.CreatePaket(ctx)
		if err != nil {
			t.Fatalf("CreatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("UpdatePaket invalid pagu", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodPatch, "/paket", strings.NewReader(`{"pagu_paket":"x.y.z"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.UpdatePaket(ctx, paketID)
		if err != nil {
			t.Fatalf("UpdatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("UpdatePaket invalid body", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodPatch, "/paket", strings.NewReader("{"))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.UpdatePaket(ctx, paketID)
		if err != nil {
			t.Fatalf("UpdatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("UpdatePaket success", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			execFn: func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
				if !strings.Contains(sql, "-- name: UpdatePaketPekerjaan :exec") {
					return pgconn.CommandTag{}, errors.New("unexpected exec")
				}
				return pgconn.NewCommandTag("UPDATE 1"), nil
			},
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				if strings.Contains(sql, "-- name: CreateActivityLog :one") {
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.UUID{Bytes: userID, Valid: true},
						"UPDATE_PAKET",
						pgtype.Text{String: "paket", Valid: true},
						pgtype.UUID{Bytes: paketID, Valid: true},
						[]byte(`{"nama":"Paket Updated"}`),
						pgtype.Text{},
						pgtype.Text{},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
					}}
				}
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			},
		}

		h := &Handler{queries: db.New(fakeDB), activity: services.NewActivityLogger(db.New(fakeDB))}
		req := httptest.NewRequest(http.MethodPatch, "/paket", strings.NewReader(`{"nama_paket":"Paket Updated","pagu_paket":"1234.56"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PPK"})

		err := h.UpdatePaket(ctx, paketID)
		if err != nil {
			t.Fatalf("UpdatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("UpdatePaket sets kasatker and lokasi", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{execFn: func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
			if !strings.Contains(sql, "-- name: UpdatePaketPekerjaan :exec") {
				return pgconn.CommandTag{}, errors.New("unexpected exec")
			}
			return pgconn.NewCommandTag("UPDATE 1"), nil
		}}

		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodPatch, "/paket", strings.NewReader(`{"kasatker":"Kasatker Baru","lokasi":"Lokasi Baru"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.UpdatePaket(ctx, paketID)
		if err != nil {
			t.Fatalf("UpdatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("UpdatePaket db error", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{execFn: func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
			return pgconn.CommandTag{}, errors.New("update failed")
		}}
		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodPatch, "/paket", strings.NewReader(`{"nama_paket":"X"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.UpdatePaket(ctx, paketID)
		if err != nil {
			t.Fatalf("UpdatePaket returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("DeletePaket mapping error", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{execFn: func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
			if strings.Contains(sql, "-- name: DeletePaketAkunMappingByPaket :exec") {
				return pgconn.CommandTag{}, errors.New("db error")
			}
			return pgconn.NewCommandTag("DELETE 1"), nil
		}}
		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodDelete, "/paket", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.DeletePaket(ctx, paketID)
		if err != nil {
			t.Fatalf("DeletePaket returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("DeletePaket success", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			execFn: func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("DELETE 1"), nil
			},
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				if strings.Contains(sql, "-- name: CreateActivityLog :one") {
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.UUID{Bytes: userID, Valid: true},
						"DELETE_PAKET",
						pgtype.Text{String: "paket", Valid: true},
						pgtype.UUID{Bytes: paketID, Valid: true},
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
		req := httptest.NewRequest(http.MethodDelete, "/paket", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PPK"})

		err := h.DeletePaket(ctx, paketID)
		if err != nil {
			t.Fatalf("DeletePaket returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("DeletePaket delete paket error", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{execFn: func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
			if strings.Contains(sql, "-- name: DeletePaketPekerjaan :exec") {
				return pgconn.CommandTag{}, errors.New("delete paket failed")
			}
			return pgconn.NewCommandTag("DELETE 1"), nil
		}}

		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodDelete, "/paket", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.DeletePaket(ctx, paketID)
		if err != nil {
			t.Fatalf("DeletePaket returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("ListPaket tahun and non-positive limit", func(t *testing.T) {
		tahun := 2026
		h := &Handler{queries: db.New(&handlerFakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			if !strings.Contains(sql, "-- name: GetComplianceMatrixPaged :many") {
				return nil, errors.New("unexpected query")
			}
			if len(args) != 3 || args[0] != int32(tahun) || args[1] != int32(50) {
				return nil, errors.New("unexpected list args")
			}
			return &handlerFakeRows{data: [][]any{}}, nil
		}})}

		req := httptest.NewRequest(http.MethodGet, "/paket?limit=0", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.ListPaket(ctx, ListPaketParams{Tahun: &tahun})
		if err != nil {
			t.Fatalf("ListPaket returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("GetPaket still returns OK when targets and realisasi queries fail", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				if strings.Contains(sql, "-- name: GetPaketPekerjaanByID :one") {
					return &handlerFakeRow{data: []any{pgtype.UUID{Bytes: paketID, Valid: true}, "Paket", "Sat", "Lok", float64ToNumeric(100), "DRAFT", pgtype.UUID{Bytes: userID, Valid: true}, pgtype.Timestamptz{}, pgtype.Timestamptz{}}}
				}
				return &handlerFakeRow{err: errors.New("unexpected query")}
			},
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				return nil, errors.New("query failed")
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
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("GetPaket maps rejection reason", func(t *testing.T) {
		realisasiID := uuid.New()
		fakeDB := &handlerFakeDBTX{
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				if strings.Contains(sql, "-- name: GetPaketPekerjaanByID :one") {
					return &handlerFakeRow{data: []any{pgtype.UUID{Bytes: paketID, Valid: true}, "Paket", "Sat", "Lok", float64ToNumeric(100), "DRAFT", pgtype.UUID{Bytes: userID, Valid: true}, pgtype.Timestamptz{}, pgtype.Timestamptz{}}}
				}
				return &handlerFakeRow{err: errors.New("unexpected query")}
			},
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				switch {
				case strings.Contains(sql, "-- name: GetPaketTargetsByPaketID :many"):
					return &handlerFakeRows{data: [][]any{}}, nil
				case strings.Contains(sql, "-- name: GetRealisasiFisikByPaketID :many"):
					return &handlerFakeRows{data: [][]any{{
						pgtype.UUID{Bytes: realisasiID, Valid: true},
						pgtype.UUID{Bytes: paketID, Valid: true},
						int32(1),
						float64ToNumeric(10),
						pgtype.Text{},
						pgtype.UUID{Bytes: userID, Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Text{String: "REJECTED", Valid: true},
						pgtype.UUID{Bytes: userID, Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Text{String: "reason", Valid: true},
						pgtype.Text{},
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
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
		if !strings.Contains(rec.Body.String(), "reason") {
			t.Fatalf("expected rejection reason in response: %s", rec.Body.String())
		}
	})
}

func TestPaketMutations_RealisasiVerifyAndDocs(t *testing.T) {
	e := echo.New()
	paketID := uuid.New()
	realisasiID := uuid.New()
	userID := uuid.New()

	t.Run("UpdateRealisasiFisik unauthorized", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodPost, "/paket/realisasi", strings.NewReader(`{"bulan":1,"persen_aktual":10}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.UpdateRealisasiFisik(ctx, paketID)
		if err != nil {
			t.Fatalf("UpdateRealisasiFisik returned error: %v", err)
		}
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("UpdateRealisasiFisik invalid body", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodPost, "/paket/realisasi", strings.NewReader("{"))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.UpdateRealisasiFisik(ctx, paketID)
		if err != nil {
			t.Fatalf("UpdateRealisasiFisik returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("UpdateRealisasiFisik invalid user id", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodPost, "/paket/realisasi", strings.NewReader(`{"bulan":1,"persen_aktual":10}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: "not-a-uuid", Role: "PPK"})

		err := h.UpdateRealisasiFisik(ctx, paketID)
		if err != nil {
			t.Fatalf("UpdateRealisasiFisik returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("UpdateRealisasiFisik db error", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			if strings.Contains(sql, "-- name: UpsertRealisasiFisik :one") {
				return &handlerFakeRow{err: errors.New("db error")}
			}
			return &handlerFakeRow{err: errors.New("unexpected query row")}
		}}
		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodPost, "/paket/realisasi", strings.NewReader(`{"bulan":1,"persen_aktual":10}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PPK"})

		err := h.UpdateRealisasiFisik(ctx, paketID)
		if err != nil {
			t.Fatalf("UpdateRealisasiFisik returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("UpdateRealisasiFisik success", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				switch {
				case strings.Contains(sql, "-- name: UpsertRealisasiFisik :one"):
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: realisasiID, Valid: true},
						pgtype.UUID{Bytes: paketID, Valid: true},
						int32(1),
						float64ToNumeric(10),
						pgtype.Text{String: "kendala", Valid: true},
						pgtype.UUID{Bytes: userID, Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Text{}, pgtype.UUID{}, pgtype.Timestamptz{}, pgtype.Text{},
					}}
				case strings.Contains(sql, "-- name: CreateActivityLog :one"):
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.UUID{Bytes: userID, Valid: true},
						"UPDATE_REALISASI",
						pgtype.Text{String: "paket", Valid: true},
						pgtype.UUID{Bytes: paketID, Valid: true},
						[]byte(`{"bulan":1,"persen":10}`),
						pgtype.Text{}, pgtype.Text{}, pgtype.Timestamptz{Time: time.Now(), Valid: true},
					}}
				default:
					return &handlerFakeRow{err: errors.New("unexpected query row")}
				}
			},
		}
		h := &Handler{queries: db.New(fakeDB), activity: services.NewActivityLogger(db.New(fakeDB))}
		req := httptest.NewRequest(http.MethodPost, "/paket/realisasi", strings.NewReader(`{"bulan":1,"persen_aktual":10,"catatan_kendala":"kendala"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PPK"})

		err := h.UpdateRealisasiFisik(ctx, paketID)
		if err != nil {
			t.Fatalf("UpdateRealisasiFisik returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("VerifyRealisasiFisik success", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
				switch {
				case strings.Contains(sql, "-- name: VerifyRealisasiFisik :one"):
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: realisasiID, Valid: true},
						pgtype.UUID{Bytes: paketID, Valid: true},
						int32(1),
						float64ToNumeric(10),
						pgtype.Text{},
						pgtype.UUID{Bytes: userID, Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Text{String: "APPROVED", Valid: true},
						pgtype.UUID{Bytes: userID, Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Text{},
					}}
				case strings.Contains(sql, "-- name: CreateActivityLog :one"):
					return &handlerFakeRow{data: []any{
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.UUID{Bytes: userID, Valid: true},
						"VERIFY_REALISASI",
						pgtype.Text{String: "realisasi", Valid: true},
						pgtype.UUID{Bytes: realisasiID, Valid: true},
						[]byte(`{"status":"APPROVED"}`),
						pgtype.Text{}, pgtype.Text{}, pgtype.Timestamptz{Time: time.Now(), Valid: true},
					}}
				default:
					return &handlerFakeRow{err: errors.New("unexpected query row")}
				}
			},
		}
		h := &Handler{queries: db.New(fakeDB), activity: services.NewActivityLogger(db.New(fakeDB))}
		req := httptest.NewRequest(http.MethodPost, "/paket/verify", strings.NewReader(`{"status":"APPROVED"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PENGAWAS"})

		err := h.VerifyRealisasiFisik(ctx, realisasiID)
		if err != nil {
			t.Fatalf("VerifyRealisasiFisik returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("VerifyRealisasiFisik unauthorized", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodPost, "/paket/verify", strings.NewReader(`{"status":"APPROVED"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		err := h.VerifyRealisasiFisik(ctx, realisasiID)
		if err != nil {
			t.Fatalf("VerifyRealisasiFisik returned error: %v", err)
		}
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("VerifyRealisasiFisik invalid body", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodPost, "/paket/verify", strings.NewReader("{"))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PENGAWAS"})

		err := h.VerifyRealisasiFisik(ctx, realisasiID)
		if err != nil {
			t.Fatalf("VerifyRealisasiFisik returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("VerifyRealisasiFisik db error", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			if strings.Contains(sql, "-- name: VerifyRealisasiFisik :one") {
				return &handlerFakeRow{err: errors.New("db error")}
			}
			return &handlerFakeRow{err: errors.New("unexpected query row")}
		}}

		h := &Handler{queries: db.New(fakeDB)}
		req := httptest.NewRequest(http.MethodPost, "/paket/verify", strings.NewReader(`{"status":"APPROVED"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PENGAWAS"})

		err := h.VerifyRealisasiFisik(ctx, realisasiID)
		if err != nil {
			t.Fatalf("VerifyRealisasiFisik returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("GetDocumentsByPaket with and without bulan", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				switch {
				case strings.Contains(sql, "-- name: GetDocumentsByPaketAndBulan :many"):
					return &handlerFakeRows{data: [][]any{{
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.UUID{Bytes: paketID, Valid: true},
						int32(1), "FISIK", "FOTO", "hash1", "f1.jpg", "image/jpeg", int64(10),
						pgtype.UUID{Bytes: userID, Valid: true}, pgtype.Timestamptz{Time: time.Now(), Valid: true}, pgtype.Text{}, pgtype.UUID{}, pgtype.Timestamptz{}, pgtype.Text{}, pgtype.Text{},
					}}}, nil
				case strings.Contains(sql, "-- name: GetDocumentsByPaket :many"):
					return &handlerFakeRows{data: [][]any{{
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.UUID{Bytes: paketID, Valid: true},
						int32(2), "KEUANGAN", "DOKUMEN", "hash2", "f2.pdf", "application/pdf", int64(20),
						pgtype.UUID{Bytes: userID, Valid: true}, pgtype.Timestamptz{Time: time.Now(), Valid: true}, pgtype.Text{}, pgtype.UUID{}, pgtype.Timestamptz{}, pgtype.Text{}, pgtype.Text{},
					}}}, nil
				default:
					return nil, errors.New("unexpected query")
				}
			},
		}
		h := &Handler{queries: db.New(fakeDB)}

		bulan := 1
		req1 := httptest.NewRequest(http.MethodGet, "/paket/docs?bulan=1", nil)
		rec1 := httptest.NewRecorder()
		ctx1 := e.NewContext(req1, rec1)
		if err := h.GetDocumentsByPaket(ctx1, paketID, GetDocumentsByPaketParams{Bulan: &bulan}); err != nil {
			t.Fatalf("GetDocumentsByPaket(bulan) returned error: %v", err)
		}
		if rec1.Code != http.StatusOK {
			t.Fatalf("unexpected status for bulan: %d", rec1.Code)
		}

		req2 := httptest.NewRequest(http.MethodGet, "/paket/docs", nil)
		rec2 := httptest.NewRecorder()
		ctx2 := e.NewContext(req2, rec2)
		if err := h.GetDocumentsByPaket(ctx2, paketID, GetDocumentsByPaketParams{}); err != nil {
			t.Fatalf("GetDocumentsByPaket(all) returned error: %v", err)
		}
		if rec2.Code != http.StatusOK {
			t.Fatalf("unexpected status for all: %d", rec2.Code)
		}
	})

	t.Run("GetDocumentsByPaket db error", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			return nil, errors.New("db error")
		}}
		h := &Handler{queries: db.New(fakeDB)}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/paket/docs", nil), rec)

		err := h.GetDocumentsByPaket(ctx, paketID, GetDocumentsByPaketParams{})
		if err != nil {
			t.Fatalf("GetDocumentsByPaket returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("GetDocumentsByPaket with bulan db error", func(t *testing.T) {
		bulan := 1
		fakeDB := &handlerFakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			if strings.Contains(sql, "-- name: GetDocumentsByPaketAndBulan :many") {
				return nil, errors.New("db error")
			}
			return nil, errors.New("unexpected query")
		}}
		h := &Handler{queries: db.New(fakeDB)}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/paket/docs?bulan=1", nil), rec)

		err := h.GetDocumentsByPaket(ctx, paketID, GetDocumentsByPaketParams{Bulan: &bulan})
		if err != nil {
			t.Fatalf("GetDocumentsByPaket returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("VerifyRealisasiFisik with rejection reason", func(t *testing.T) {
		reason := "belum sesuai"
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			if strings.Contains(sql, "-- name: VerifyRealisasiFisik :one") {
				return &handlerFakeRow{data: []any{pgtype.UUID{Bytes: realisasiID, Valid: true}, pgtype.UUID{Bytes: paketID, Valid: true}, int32(1), float64ToNumeric(10), pgtype.Text{}, pgtype.UUID{Bytes: userID, Valid: true}, pgtype.Timestamptz{}, pgtype.Text{String: "REJECTED", Valid: true}, pgtype.UUID{Bytes: userID, Valid: true}, pgtype.Timestamptz{}, pgtype.Text{String: reason, Valid: true}}}
			}
			if strings.Contains(sql, "-- name: CreateActivityLog :one") {
				return &handlerFakeRow{data: []any{pgtype.UUID{Bytes: uuid.New(), Valid: true}, pgtype.UUID{Bytes: userID, Valid: true}, "VERIFY_REALISASI", pgtype.Text{String: "realisasi", Valid: true}, pgtype.UUID{Bytes: realisasiID, Valid: true}, []byte(`{"status":"REJECTED"}`), pgtype.Text{}, pgtype.Text{}, pgtype.Timestamptz{Time: time.Now(), Valid: true}}}
			}
			return &handlerFakeRow{err: errors.New("unexpected query")}
		}}

		h := &Handler{queries: db.New(fakeDB), activity: services.NewActivityLogger(db.New(fakeDB))}
		req := httptest.NewRequest(http.MethodPost, "/paket/verify", strings.NewReader(`{"status":"REJECTED","rejection_reason":"`+reason+`"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "PENGAWAS"})

		err := h.VerifyRealisasiFisik(ctx, realisasiID)
		if err != nil {
			t.Fatalf("VerifyRealisasiFisik returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})
}
