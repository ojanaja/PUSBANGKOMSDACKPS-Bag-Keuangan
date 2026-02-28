package handlers

import (
	"bytes"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	authmw "github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/api/middleware"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/services"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func TestIsAllowedUploadMime_Fisik(t *testing.T) {
	cases := []struct {
		name         string
		kategori     string
		filename     string
		detectedMime string
		header       []byte
		want         bool
	}{
		{"jpeg ok", "FISIK", "foto.jpg", "image/jpeg", nil, true},
		{"png ok", "fisik", "foto.png", "image/png", nil, true},
		{"pdf not ok", "FISIK", "doc.pdf", "application/pdf", nil, false},
		{"csv not ok", "FISIK", "data.csv", "text/csv", nil, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isAllowedUploadMime(tc.kategori, tc.filename, tc.detectedMime, tc.header); got != tc.want {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}

func TestIsAllowedUploadMime_Keuangan(t *testing.T) {
	oleHeader := []byte{0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1}

	cases := []struct {
		name         string
		kategori     string
		filename     string
		detectedMime string
		header       []byte
		want         bool
	}{
		{"pdf ok", "KEUANGAN", "doc.pdf", "application/pdf", nil, true},
		{"csv ok", "KEUANGAN", "data.csv", "text/csv", nil, true},
		{"csv wrong ext", "KEUANGAN", "data.txt", "text/csv", nil, false},
		{"text/plain csv ok", "KEUANGAN", "data.csv", "text/plain", nil, true},
		{"text/plain wrong ext", "KEUANGAN", "data.txt", "text/plain", nil, false},
		{"docx zip ok", "KEUANGAN", "x.docx", "application/zip", nil, true},
		{"xlsx zip ok", "KEUANGAN", "x.xlsx", "application/zip", nil, true},
		{"pptx zip ok", "KEUANGAN", "x.pptx", "application/zip", nil, true},
		{"zip wrong ext", "KEUANGAN", "x.zip", "application/zip", nil, false},
		{"ole doc ok", "KEUANGAN", "x.doc", "application/octet-stream", oleHeader, true},
		{"ole xls ok", "KEUANGAN", "x.xls", "application/octet-stream", oleHeader, true},
		{"ole wrong ext", "KEUANGAN", "x.bin", "application/octet-stream", oleHeader, false},
		{"image not ok", "KEUANGAN", "x.png", "image/png", nil, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isAllowedUploadMime(tc.kategori, tc.filename, tc.detectedMime, tc.header); got != tc.want {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}

func TestIsAllowedJenisDokumen(t *testing.T) {
	cases := []struct {
		name     string
		kategori string
		jenis    string
		want     bool
	}{
		{"fisik foto ok", "FISIK", "FOTO", true},
		{"fisik dokumen no", "FISIK", "DOKUMEN", false},
		{"keuangan dokumen ok", "KEUANGAN", "DOKUMEN", true},
		{"keuangan foto no", "KEUANGAN", "FOTO", false},
		{"trim+case ok", "  fisik ", " foto ", true},
		{"unknown kategori no", "LAIN", "FOTO", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isAllowedJenisDokumen(tc.kategori, tc.jenis); got != tc.want {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}

func TestIsAllowedKategori(t *testing.T) {
	cases := []struct {
		kategori string
		want     bool
	}{
		{"FISIK", true},
		{"KEUANGAN", true},
		{" fisik ", true},
		{"other", false},
		{"", false},
	}

	for _, tc := range cases {
		if got := isAllowedKategori(tc.kategori); got != tc.want {
			t.Fatalf("kategori=%q got %v, want %v", tc.kategori, got, tc.want)
		}
	}
}

func TestUploadDocument_Branches(t *testing.T) {
	e := echo.New()
	userID := uuid.New()
	paketID := uuid.New()
	docID := uuid.New()

	makeUploadReq := func(kategori, jenis, bulan, paket string, payload []byte, filename string) *http.Request {
		var body bytes.Buffer
		mw := multipart.NewWriter(&body)
		_ = mw.WriteField("paket_id", paket)
		_ = mw.WriteField("bulan", bulan)
		_ = mw.WriteField("kategori", kategori)
		_ = mw.WriteField("jenis_dokumen", jenis)
		fw, _ := mw.CreateFormFile("file", filename)
		_, _ = fw.Write(payload)
		_ = mw.Close()

		req := httptest.NewRequest(http.MethodPost, "/documents/upload", &body)
		req.Header.Set(echo.HeaderContentType, mw.FormDataContentType())
		return req
	}

	makeDocRow := func(id uuid.UUID) []any {
		return []any{
			pgtype.UUID{Bytes: id, Valid: true},
			pgtype.UUID{Bytes: paketID, Valid: true},
			int32(1),
			"FISIK",
			"FOTO",
			"hash",
			"foto.png",
			"image/png",
			int64(12),
			pgtype.UUID{Bytes: userID, Valid: true},
			pgtype.Timestamptz{Time: time.Now(), Valid: true},
			pgtype.Text{},
			pgtype.UUID{},
			pgtype.Timestamptz{},
			pgtype.Text{},
		}
	}

	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 0, 1, 2}

	t.Run("invalid kategori", func(t *testing.T) {
		h := &Handler{}
		req := makeUploadReq("LAIN", "FOTO", "1", paketID.String(), png, "foto.png")
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		if err := h.UploadDocument(ctx); err != nil {
			t.Fatalf("UploadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("missing file", func(t *testing.T) {
		var body bytes.Buffer
		mw := multipart.NewWriter(&body)
		_ = mw.WriteField("paket_id", paketID.String())
		_ = mw.WriteField("bulan", "1")
		_ = mw.WriteField("kategori", "FISIK")
		_ = mw.WriteField("jenis_dokumen", "FOTO")
		_ = mw.Close()

		req := httptest.NewRequest(http.MethodPost, "/documents/upload", &body)
		req.Header.Set(echo.HeaderContentType, mw.FormDataContentType())
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		h := &Handler{}
		if err := h.UploadDocument(ctx); err != nil {
			t.Fatalf("UploadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("missing kategori/jenis", func(t *testing.T) {
		h := &Handler{}
		req := makeUploadReq("", "", "1", paketID.String(), png, "foto.png")
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		if err := h.UploadDocument(ctx); err != nil {
			t.Fatalf("UploadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("invalid jenis for kategori", func(t *testing.T) {
		h := &Handler{}
		req := makeUploadReq("FISIK", "DOKUMEN", "1", paketID.String(), png, "foto.png")
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		if err := h.UploadDocument(ctx); err != nil {
			t.Fatalf("UploadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("invalid bulan", func(t *testing.T) {
		h := &Handler{}
		req := makeUploadReq("FISIK", "FOTO", "13", paketID.String(), png, "foto.png")
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		if err := h.UploadDocument(ctx); err != nil {
			t.Fatalf("UploadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("invalid paket id", func(t *testing.T) {
		h := &Handler{}
		req := makeUploadReq("FISIK", "FOTO", "1", "not-uuid", png, "foto.png")
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		if err := h.UploadDocument(ctx); err != nil {
			t.Fatalf("UploadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("sniff open failure", func(t *testing.T) {
		oldOpen := openMultipartFile
		openMultipartFile = func(fileHeader *multipart.FileHeader) (multipart.File, error) {
			return nil, errors.New("open failed")
		}
		defer func() { openMultipartFile = oldOpen }()

		h := &Handler{}
		req := makeUploadReq("FISIK", "FOTO", "1", paketID.String(), png, "foto.png")
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		if err := h.UploadDocument(ctx); err != nil {
			t.Fatalf("UploadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("src open failure after successful sniff", func(t *testing.T) {
		oldOpen := openMultipartFile
		openCalls := 0
		openMultipartFile = func(fileHeader *multipart.FileHeader) (multipart.File, error) {
			openCalls++
			if openCalls == 1 {
				tmp, err := os.CreateTemp(t.TempDir(), "sniff-*")
				if err != nil {
					return nil, err
				}
				if _, err := tmp.Write(png); err != nil {
					_ = tmp.Close()
					return nil, err
				}
				if _, err := tmp.Seek(0, 0); err != nil {
					_ = tmp.Close()
					return nil, err
				}
				return tmp, nil
			}
			return nil, errors.New("second open failed")
		}
		defer func() { openMultipartFile = oldOpen }()

		h := &Handler{}
		req := makeUploadReq("FISIK", "FOTO", "1", paketID.String(), png, "foto.png")
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		if err := h.UploadDocument(ctx); err != nil {
			t.Fatalf("UploadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("file type not allowed", func(t *testing.T) {
		h := &Handler{}
		txt := []byte("plain text")
		req := makeUploadReq("FISIK", "FOTO", "1", paketID.String(), txt, "file.txt")
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		if err := h.UploadDocument(ctx); err != nil {
			t.Fatalf("UploadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("unauthorized without claims", func(t *testing.T) {
		tmp := t.TempDir()
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			return &handlerFakeRow{err: errors.New("unexpected query row")}
		}}
		h := &Handler{queries: db.New(fakeDB), cas: services.NewCASStorage(tmp)}

		req := makeUploadReq("FISIK", "FOTO", "1", paketID.String(), png, "foto.png")
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		if err := h.UploadDocument(ctx); err != nil {
			t.Fatalf("UploadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("success", func(t *testing.T) {
		tmp := t.TempDir()
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			switch {
			case strings.Contains(sql, "-- name: InsertDocument :one"):
				return &handlerFakeRow{data: makeDocRow(docID)}
			case strings.Contains(sql, "-- name: CreateActivityLog :one"):
				return &handlerFakeRow{data: []any{
					pgtype.UUID{Bytes: uuid.New(), Valid: true},
					pgtype.UUID{Bytes: userID, Valid: true},
					"UPLOAD_DOCUMENT",
					pgtype.Text{String: "document", Valid: true},
					pgtype.UUID{Bytes: docID, Valid: true},
					[]byte(`{"ok":true}`),
					pgtype.Text{},
					pgtype.Text{},
					pgtype.Timestamptz{Time: time.Now(), Valid: true},
				}}
			default:
				return &handlerFakeRow{err: errors.New("unexpected query row")}
			}
		}}
		h := &Handler{queries: db.New(fakeDB), cas: services.NewCASStorage(tmp), activity: services.NewActivityLogger(db.New(fakeDB))}

		req := makeUploadReq("FISIK", "FOTO", "1", paketID.String(), png, "foto.png")
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "ADMIN"})

		if err := h.UploadDocument(ctx); err != nil {
			t.Fatalf("UploadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusCreated {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("invalid user id in claims", func(t *testing.T) {
		tmp := t.TempDir()
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			return &handlerFakeRow{err: errors.New("unexpected query")}
		}}
		h := &Handler{queries: db.New(fakeDB), cas: services.NewCASStorage(tmp)}

		req := makeUploadReq("FISIK", "FOTO", "1", paketID.String(), png, "foto.png")
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: "not-uuid", Role: "ADMIN"})

		if err := h.UploadDocument(ctx); err != nil {
			t.Fatalf("UploadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("cas save fails", func(t *testing.T) {
		baseFile := t.TempDir() + "/not-dir"
		if err := os.WriteFile(baseFile, []byte("x"), 0644); err != nil {
			t.Fatalf("failed to create base file: %v", err)
		}
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			return &handlerFakeRow{err: errors.New("unexpected query")}
		}}
		h := &Handler{queries: db.New(fakeDB), cas: services.NewCASStorage(baseFile)}

		req := makeUploadReq("FISIK", "FOTO", "1", paketID.String(), png, "foto.png")
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "ADMIN"})

		if err := h.UploadDocument(ctx); err != nil {
			t.Fatalf("UploadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("insert document fails", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			if strings.Contains(sql, "-- name: InsertDocument :one") {
				return &handlerFakeRow{err: errors.New("insert failed")}
			}
			return &handlerFakeRow{err: errors.New("unexpected query")}
		}}
		h := &Handler{queries: db.New(fakeDB), cas: services.NewCASStorage(t.TempDir())}

		req := makeUploadReq("FISIK", "FOTO", "1", paketID.String(), png, "foto.png")
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "ADMIN"})

		if err := h.UploadDocument(ctx); err != nil {
			t.Fatalf("UploadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}
	})
}

func TestDownloadAndVerifyDocument_Branches(t *testing.T) {
	e := echo.New()
	userID := uuid.New()
	paketID := uuid.New()
	docID := uuid.New()

	makeDocRow := func(hash, name string) []any {
		return []any{
			pgtype.UUID{Bytes: docID, Valid: true},
			pgtype.UUID{Bytes: paketID, Valid: true},
			int32(2),
			"KEUANGAN",
			"DOKUMEN",
			hash,
			name,
			"application/pdf",
			int64(10),
			pgtype.UUID{Bytes: userID, Valid: true},
			pgtype.Timestamptz{Time: time.Now(), Valid: true},
			pgtype.Text{},
			pgtype.UUID{},
			pgtype.Timestamptz{},
			pgtype.Text{},
		}
	}

	t.Run("download not found", func(t *testing.T) {
		h := &Handler{queries: db.New(&handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			return &handlerFakeRow{err: errors.New("not found")}
		}}), cas: services.NewCASStorage(t.TempDir())}

		req := httptest.NewRequest(http.MethodGet, "/documents/"+docID.String(), nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		if err := h.DownloadDocument(ctx, openapi_types.UUID(docID)); err != nil {
			t.Fatalf("DownloadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusNotFound {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("download file missing in cas", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			return &handlerFakeRow{data: makeDocRow("missing-hash", "x.pdf")}
		}}
		h := &Handler{queries: db.New(fakeDB), cas: services.NewCASStorage(t.TempDir())}

		req := httptest.NewRequest(http.MethodGet, "/documents/"+docID.String(), nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		if err := h.DownloadDocument(ctx, openapi_types.UUID(docID)); err != nil {
			t.Fatalf("DownloadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusNotFound {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("download success attachment", func(t *testing.T) {
		tmp := t.TempDir()
		cas := services.NewCASStorage(tmp)
		hash := "abc123"
		if err := os.WriteFile(cas.GetPath(hash), []byte("hello world"), 0644); err != nil {
			t.Fatalf("WriteFile failed: %v", err)
		}

		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			return &handlerFakeRow{data: makeDocRow(hash, "report.pdf")}
		}}
		h := &Handler{queries: db.New(fakeDB), cas: cas}

		req := httptest.NewRequest(http.MethodGet, "/documents/"+docID.String()+"?download=true", nil)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		if err := h.DownloadDocument(ctx, openapi_types.UUID(docID)); err != nil {
			t.Fatalf("DownloadDocument returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
		if !strings.Contains(rec.Header().Get(echo.HeaderContentDisposition), "attachment") {
			t.Fatalf("expected attachment disposition, got %q", rec.Header().Get(echo.HeaderContentDisposition))
		}
	})

	t.Run("verify unauthorized", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodPost, "/documents/verify", strings.NewReader(`{"status":"VERIFIED"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)

		if err := h.VerifyDocument(ctx, openapi_types.UUID(docID)); err != nil {
			t.Fatalf("VerifyDocument returned error: %v", err)
		}
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("verify invalid body", func(t *testing.T) {
		h := &Handler{}
		req := httptest.NewRequest(http.MethodPost, "/documents/verify", strings.NewReader(`{"status":`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "ADMIN"})

		if err := h.VerifyDocument(ctx, openapi_types.UUID(docID)); err != nil {
			t.Fatalf("VerifyDocument returned error: %v", err)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("verify db error", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			if strings.Contains(sql, "-- name: VerifyDocument :one") {
				return &handlerFakeRow{err: errors.New("verify failed")}
			}
			return &handlerFakeRow{err: errors.New("unexpected query")}
		}}
		h := &Handler{queries: db.New(fakeDB), activity: services.NewActivityLogger(db.New(fakeDB))}

		req := httptest.NewRequest(http.MethodPost, "/documents/verify", strings.NewReader(`{"status":"REJECTED","rejection_reason":"bad file"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "ADMIN"})

		if err := h.VerifyDocument(ctx, openapi_types.UUID(docID)); err != nil {
			t.Fatalf("VerifyDocument returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("verify success", func(t *testing.T) {
		fakeDB := &handlerFakeDBTX{queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			switch {
			case strings.Contains(sql, "-- name: VerifyDocument :one"):
				return &handlerFakeRow{data: makeDocRow("h", "report.pdf")}
			case strings.Contains(sql, "-- name: CreateActivityLog :one"):
				return &handlerFakeRow{data: []any{
					pgtype.UUID{Bytes: uuid.New(), Valid: true},
					pgtype.UUID{Bytes: userID, Valid: true},
					"VERIFY_DOCUMENT",
					pgtype.Text{String: "document", Valid: true},
					pgtype.UUID{Bytes: docID, Valid: true},
					[]byte(`{"status":"VERIFIED"}`),
					pgtype.Text{},
					pgtype.Text{},
					pgtype.Timestamptz{Time: time.Now(), Valid: true},
				}}
			default:
				return &handlerFakeRow{err: errors.New("unexpected query")}
			}
		}}
		h := &Handler{queries: db.New(fakeDB), activity: services.NewActivityLogger(db.New(fakeDB))}

		req := httptest.NewRequest(http.MethodPost, "/documents/verify", strings.NewReader(`{"status":"VERIFIED"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		ctx := e.NewContext(req, rec)
		ctx.Set(authmw.UserClaimsKey, &services.Claims{UserID: userID.String(), Role: "ADMIN"})

		if err := h.VerifyDocument(ctx, openapi_types.UUID(docID)); err != nil {
			t.Fatalf("VerifyDocument returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})
}
