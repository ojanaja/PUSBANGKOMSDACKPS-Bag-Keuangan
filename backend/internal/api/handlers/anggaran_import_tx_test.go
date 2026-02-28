package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
)

type fakeImportTx struct {
	execFn     func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	copyFromFn func(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error)
	queryRowFn func(ctx context.Context, sql string, args ...any) pgx.Row
	commitErr  error
}

func (f *fakeImportTx) Begin(ctx context.Context) (pgx.Tx, error) { return f, nil }
func (f *fakeImportTx) Commit(ctx context.Context) error          { return f.commitErr }
func (f *fakeImportTx) Rollback(ctx context.Context) error        { return nil }
func (f *fakeImportTx) CopyFrom(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error) {
	if f.copyFromFn != nil {
		return f.copyFromFn(ctx, tableName, columnNames, rowSrc)
	}
	return 1, nil
}
func (f *fakeImportTx) SendBatch(ctx context.Context, b *pgx.Batch) pgx.BatchResults { return nil }
func (f *fakeImportTx) LargeObjects() pgx.LargeObjects                               { return pgx.LargeObjects{} }
func (f *fakeImportTx) Prepare(ctx context.Context, name, sql string) (*pgconn.StatementDescription, error) {
	return nil, nil
}
func (f *fakeImportTx) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	if f.execFn != nil {
		return f.execFn(ctx, sql, arguments...)
	}
	return pgconn.NewCommandTag("OK"), nil
}
func (f *fakeImportTx) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeImportTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	if f.queryRowFn != nil {
		return f.queryRowFn(ctx, sql, args...)
	}
	return &handlerFakeRow{err: errors.New("queryRowFn not set")}
}
func (f *fakeImportTx) Conn() *pgx.Conn { return nil }

func makeImportRequest(t *testing.T, csvContent string, tahun string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	fw, err := writer.CreateFormFile("file", "anggaran.csv")
	if err != nil {
		t.Fatalf("CreateFormFile error: %v", err)
	}
	_, _ = fw.Write([]byte(csvContent))
	_ = writer.WriteField("tahun_anggaran", tahun)
	if err := writer.Close(); err != nil {
		t.Fatalf("writer.Close error: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/anggaran/import", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func newImportQueryRowFn() func(ctx context.Context, sql string, args ...any) pgx.Row {
	programID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
	kegiatanID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
	outputID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
	subOutputID := pgtype.UUID{Bytes: uuid.New(), Valid: true}

	return func(ctx context.Context, sql string, args ...any) pgx.Row {
		switch {
		case strings.Contains(sql, "-- name: InsertAnggaranProgram :one"):
			return &handlerFakeRow{data: []any{programID, "P1", "Program 1", int32(2026)}}
		case strings.Contains(sql, "-- name: InsertAnggaranKegiatan :one"):
			return &handlerFakeRow{data: []any{kegiatanID, programID, "K1", "Kegiatan 1"}}
		case strings.Contains(sql, "-- name: InsertAnggaranOutput :one"):
			return &handlerFakeRow{data: []any{outputID, kegiatanID, "O1", "Output 1"}}
		case strings.Contains(sql, "-- name: InsertAnggaranSubOutput :one"):
			return &handlerFakeRow{data: []any{subOutputID, outputID, "S1", "SubOutput 1"}}
		default:
			return &handlerFakeRow{err: errors.New("unexpected query row")}
		}
	}
}

func makeLargeImportCSV(rowCount int) string {
	var b strings.Builder
	b.WriteString("programkode,programuraian,kegiatankode,kegiatanuraian,outputkode,outputuraian,suboutputkode,suboutputuraian,akunkode,akunuraian,pagu,realisasi,sisa\n")
	for i := 0; i < rowCount; i++ {
		b.WriteString(fmt.Sprintf("P1,Program 1,K1,Kegiatan 1,O1,Output 1,S1,SubOutput 1,A%d,Akun %d,100,50,50\n", i, i))
	}
	return b.String()
}

func TestImportAnggaranData_TransactionFailureBranches(t *testing.T) {
	validCSV := "programkode,programuraian,kegiatankode,kegiatanuraian,outputkode,outputuraian,suboutputkode,suboutputuraian,akunkode,akunuraian,pagu,realisasi,sisa\n" +
		"P1,Program 1,K1,Kegiatan 1,O1,Output 1,S1,SubOutput 1,A1,Akun 1,100,50,50\n"

	invalidCSV := "programkode,programuraian\nP1,Program 1\n"

	newHandler := func(tx *fakeImportTx) *Handler {
		return &Handler{
			queries: db.New(&handlerFakeDBTX{}),
			pool: &fakeBeginPool{beginFn: func(ctx context.Context) (pgx.Tx, error) {
				return tx, nil
			}},
		}
	}

	t.Run("invalid tahun anggaran", func(t *testing.T) {
		h := &Handler{}
		rec := httptest.NewRecorder()
		ctx := echoContext(t, makeImportRequest(t, validCSV, "not-int"), rec)

		if err := h.ImportAnggaranData(ctx); err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("file open failure", func(t *testing.T) {
		oldOpen := openMultipartFile
		openMultipartFile = func(fileHeader *multipart.FileHeader) (multipart.File, error) {
			return nil, errors.New("open failed")
		}
		defer func() { openMultipartFile = oldOpen }()

		h := &Handler{}
		rec := httptest.NewRecorder()
		ctx := echoContext(t, makeImportRequest(t, validCSV, "2026"), rec)

		if err := h.ImportAnggaranData(ctx); err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("temp table exec failure", func(t *testing.T) {
		tx := &fakeImportTx{execFn: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
			if strings.Contains(sql, "CREATE TEMP TABLE anggaran_akun_import") {
				return pgconn.CommandTag{}, errors.New("create temp failed")
			}
			return pgconn.NewCommandTag("OK"), nil
		}}

		h := newHandler(tx)
		rec := httptest.NewRecorder()
		ctx := echoContext(t, makeImportRequest(t, validCSV, "2026"), rec)

		if err := h.ImportAnggaranData(ctx); err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("csv parse failure", func(t *testing.T) {
		tx := &fakeImportTx{}
		h := newHandler(tx)
		rec := httptest.NewRecorder()
		ctx := echoContext(t, makeImportRequest(t, invalidCSV, "2026"), rec)

		if err := h.ImportAnggaranData(ctx); err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("copy from failure", func(t *testing.T) {
		tx := &fakeImportTx{
			queryRowFn: newImportQueryRowFn(),
			copyFromFn: func(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error) {
				return 0, errors.New("copy failed")
			},
		}

		h := newHandler(tx)
		rec := httptest.NewRecorder()
		ctx := echoContext(t, makeImportRequest(t, validCSV, "2026"), rec)

		if err := h.ImportAnggaranData(ctx); err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("merge exec failure", func(t *testing.T) {
		tx := &fakeImportTx{
			queryRowFn: newImportQueryRowFn(),
			execFn: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				if strings.Contains(sql, "INSERT INTO anggaran_akun") {
					return pgconn.CommandTag{}, errors.New("merge failed")
				}
				return pgconn.NewCommandTag("OK"), nil
			},
		}

		h := newHandler(tx)
		rec := httptest.NewRecorder()
		ctx := echoContext(t, makeImportRequest(t, validCSV, "2026"), rec)

		if err := h.ImportAnggaranData(ctx); err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("commit failure", func(t *testing.T) {
		tx := &fakeImportTx{
			queryRowFn: newImportQueryRowFn(),
			commitErr:  errors.New("commit failed"),
		}

		h := newHandler(tx)
		rec := httptest.NewRecorder()
		ctx := echoContext(t, makeImportRequest(t, validCSV, "2026"), rec)

		if err := h.ImportAnggaranData(ctx); err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("program insert failure", func(t *testing.T) {
		tx := &fakeImportTx{queryRowFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
			if strings.Contains(sql, "-- name: InsertAnggaranProgram :one") {
				return &handlerFakeRow{err: errors.New("program failed")}
			}
			return &handlerFakeRow{err: errors.New("unexpected query row")}
		}}

		h := newHandler(tx)
		rec := httptest.NewRecorder()
		ctx := echoContext(t, makeImportRequest(t, validCSV, "2026"), rec)
		if err := h.ImportAnggaranData(ctx); err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("kegiatan insert failure", func(t *testing.T) {
		tx := &fakeImportTx{queryRowFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
			switch {
			case strings.Contains(sql, "-- name: InsertAnggaranProgram :one"):
				return &handlerFakeRow{data: []any{pgtype.UUID{Bytes: uuid.New(), Valid: true}, "P1", "Program 1", int32(2026)}}
			case strings.Contains(sql, "-- name: InsertAnggaranKegiatan :one"):
				return &handlerFakeRow{err: errors.New("kegiatan failed")}
			default:
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			}
		}}

		h := newHandler(tx)
		rec := httptest.NewRecorder()
		ctx := echoContext(t, makeImportRequest(t, validCSV, "2026"), rec)
		if err := h.ImportAnggaranData(ctx); err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("output insert failure", func(t *testing.T) {
		tx := &fakeImportTx{queryRowFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
			switch {
			case strings.Contains(sql, "-- name: InsertAnggaranProgram :one"):
				progID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
				return &handlerFakeRow{data: []any{progID, "P1", "Program 1", int32(2026)}}
			case strings.Contains(sql, "-- name: InsertAnggaranKegiatan :one"):
				progID := pgtype.UUID{Bytes: uuid.New(), Valid: true}
				return &handlerFakeRow{data: []any{pgtype.UUID{Bytes: uuid.New(), Valid: true}, progID, "K1", "Kegiatan 1"}}
			case strings.Contains(sql, "-- name: InsertAnggaranOutput :one"):
				return &handlerFakeRow{err: errors.New("output failed")}
			default:
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			}
		}}

		h := newHandler(tx)
		rec := httptest.NewRecorder()
		ctx := echoContext(t, makeImportRequest(t, validCSV, "2026"), rec)
		if err := h.ImportAnggaranData(ctx); err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("sub output insert failure", func(t *testing.T) {
		tx := &fakeImportTx{queryRowFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
			switch {
			case strings.Contains(sql, "-- name: InsertAnggaranProgram :one"):
				return &handlerFakeRow{data: []any{pgtype.UUID{Bytes: uuid.New(), Valid: true}, "P1", "Program 1", int32(2026)}}
			case strings.Contains(sql, "-- name: InsertAnggaranKegiatan :one"):
				return &handlerFakeRow{data: []any{pgtype.UUID{Bytes: uuid.New(), Valid: true}, pgtype.UUID{Bytes: uuid.New(), Valid: true}, "K1", "Kegiatan 1"}}
			case strings.Contains(sql, "-- name: InsertAnggaranOutput :one"):
				return &handlerFakeRow{data: []any{pgtype.UUID{Bytes: uuid.New(), Valid: true}, pgtype.UUID{Bytes: uuid.New(), Valid: true}, "O1", "Output 1"}}
			case strings.Contains(sql, "-- name: InsertAnggaranSubOutput :one"):
				return &handlerFakeRow{err: errors.New("sub output failed")}
			default:
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			}
		}}

		h := newHandler(tx)
		rec := httptest.NewRecorder()
		ctx := echoContext(t, makeImportRequest(t, validCSV, "2026"), rec)
		if err := h.ImportAnggaranData(ctx); err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("batch flush inside loop failure", func(t *testing.T) {
		largeCSV := makeLargeImportCSV(2001)
		tx := &fakeImportTx{
			queryRowFn: newImportQueryRowFn(),
			copyFromFn: func(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error) {
				return 0, errors.New("batch copy failed")
			},
		}

		h := newHandler(tx)
		rec := httptest.NewRecorder()
		ctx := echoContext(t, makeImportRequest(t, largeCSV, "2026"), rec)
		if err := h.ImportAnggaranData(ctx); err != nil {
			t.Fatalf("ImportAnggaranData returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})
}

func TestImportAnggaranData_Success(t *testing.T) {
	validCSV := "programkode,programuraian,kegiatankode,kegiatanuraian,outputkode,outputuraian,suboutputkode,suboutputuraian,akunkode,akunuraian,pagu,realisasi,sisa\n" +
		"P1,Program 1,K1,Kegiatan 1,O1,Output 1,S1,SubOutput 1,A1,Akun 1,100,50,50\n"

	tx := &fakeImportTx{
		queryRowFn: newImportQueryRowFn(),
	}
	h := &Handler{
		queries: db.New(&handlerFakeDBTX{}),
		pool: &fakeBeginPool{beginFn: func(ctx context.Context) (pgx.Tx, error) {
			return tx, nil
		}},
	}

	rec := httptest.NewRecorder()
	ctx := echoContext(t, makeImportRequest(t, validCSV, "2026"), rec)

	if err := h.ImportAnggaranData(ctx); err != nil {
		t.Fatalf("ImportAnggaranData returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}

	var got AnggaranImportResult
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.ProgramsUpserted == nil || *got.ProgramsUpserted != 1 {
		t.Fatalf("unexpected ProgramsUpserted: %+v", got.ProgramsUpserted)
	}
	if got.AkunUpserted == nil || *got.AkunUpserted != 1 {
		t.Fatalf("unexpected AkunUpserted: %+v", got.AkunUpserted)
	}
}

func TestImportAnggaranData_SuccessExactBatchHitsEmptyFinalFlush(t *testing.T) {
	batchCSV := makeLargeImportCSV(2000)
	tx := &fakeImportTx{queryRowFn: newImportQueryRowFn()}
	h := &Handler{
		queries: db.New(&handlerFakeDBTX{}),
		pool: &fakeBeginPool{beginFn: func(ctx context.Context) (pgx.Tx, error) {
			return tx, nil
		}},
	}

	rec := httptest.NewRecorder()
	ctx := echoContext(t, makeImportRequest(t, batchCSV, "2026"), rec)

	if err := h.ImportAnggaranData(ctx); err != nil {
		t.Fatalf("ImportAnggaranData returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
}

func echoContext(t *testing.T, req *http.Request, rec *httptest.ResponseRecorder) echo.Context {
	t.Helper()
	e := echo.New()
	return e.NewContext(req, rec)
}
