package handlers

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	authmw "github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/api/middleware"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func (h *Handler) UploadDocument(ctx echo.Context) error {
	file, err := ctx.FormFile("file")
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "file is required"})
	}

	paketIDStr := ctx.FormValue("paket_id")
	bulanStr := ctx.FormValue("bulan")
	kategori := ctx.FormValue("kategori")
	jenisDokumen := ctx.FormValue("jenis_dokumen")

	if kategori == "" || jenisDokumen == "" {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "kategori and jenis_dokumen are required"})
	}
	if !isAllowedKategori(kategori) {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid kategori"})
	}
	if !isAllowedJenisDokumen(kategori, jenisDokumen) {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid jenis_dokumen for kategori"})
	}

	kategori = strings.ToUpper(strings.TrimSpace(kategori))
	jenisDokumen = strings.ToUpper(strings.TrimSpace(jenisDokumen))

	bulan, err := strconv.Atoi(bulanStr)
	if err != nil || bulan < 1 || bulan > 12 {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "bulan must be 1-12"})
	}

	paketUUID, err := uuid.Parse(paketIDStr)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid paket_id"})
	}

	sniff, err := openMultipartFile(file)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to open file"})
	}
	header := make([]byte, 512)
	n, _ := io.ReadFull(sniff, header)
	_ = sniff.Close()
	mimeType := http.DetectContentType(header[:n])
	if !isAllowedUploadMime(kategori, file.Filename, mimeType, header[:n]) {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "file type not allowed"})
	}

	src, err := openMultipartFile(file)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to open file"})
	}
	defer src.Close()

	result, err := h.cas.Save(src)
	if err != nil {
		slog.Error("CAS save failed", "error", fmt.Errorf("cas save: %w", err))
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to save file"})
	}

	docID := newPgUUID()
	claims := authmw.GetClaims(ctx)
	if claims == nil {
		return ctx.JSON(http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
	}
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "invalid user id"})
	}

	doc, err := h.queries.InsertDocument(ctx.Request().Context(), db.InsertDocumentParams{
		ID:             docID,
		PaketID:        uuidToPgUUID(paketUUID),
		Bulan:          int32(bulan),
		Kategori:       kategori,
		JenisDokumen:   jenisDokumen,
		FileHashSha256: result.Hash,
		OriginalName:   file.Filename,
		MimeType:       result.MimeType,
		FileSizeBytes:  result.Size,
		UploadedBy:     uuidToPgUUID(userID),
	})
	if err != nil {
		slog.Error("InsertDocument failed", "error", fmt.Errorf("insert document: %w", err))
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to save metadata"})
	}

	bulanInt := int(doc.Bulan)
	sizeInt := int(doc.FileSizeBytes)
	h.activity.Log(ctx.Request().Context(), userID, "UPLOAD_DOCUMENT", "document", ptr(uuid.UUID(doc.ID.Bytes)), map[string]interface{}{"filename": doc.OriginalName, "kategori": doc.Kategori}, ctx.RealIP(), ctx.Request().UserAgent())

	return ctx.JSON(http.StatusCreated, DocumentMeta{
		Id:             pgUUIDToOpenAPI(doc.ID),
		PaketId:        pgUUIDToOpenAPI(doc.PaketID),
		Bulan:          &bulanInt,
		Kategori:       &doc.Kategori,
		JenisDokumen:   &doc.JenisDokumen,
		FileHashSha256: &doc.FileHashSha256,
		OriginalName:   &doc.OriginalName,
		MimeType:       &doc.MimeType,
		FileSizeBytes:  &sizeInt,
	})
}

func (h *Handler) DownloadDocument(ctx echo.Context, id openapi_types.UUID) error {
	doc, err := h.queries.GetDocumentByID(ctx.Request().Context(), uuidToPgUUID(id))
	if err != nil {
		slog.Error("GetDocumentByID failed", "error", err, "id", id)
		return ctx.JSON(http.StatusNotFound, map[string]string{"message": "document not found"})
	}

	if !h.cas.Exists(doc.FileHashSha256) {
		slog.Error("File missing in CAS", "hash", doc.FileHashSha256)
		return ctx.JSON(http.StatusNotFound, map[string]string{"message": "file content not found"})
	}

	path := h.cas.GetPath(doc.FileHashSha256)
	ctx.Response().Header().Set(echo.HeaderContentType, doc.MimeType)

	disposition := "inline"
	if ctx.QueryParam("download") == "true" {
		disposition = fmt.Sprintf("attachment; filename=%q", doc.OriginalName)
	}
	ctx.Response().Header().Set(echo.HeaderContentDisposition, disposition)
	return ctx.File(path)
}

func (h *Handler) VerifyDocument(ctx echo.Context, id openapi_types.UUID) error {
	claims := authmw.GetClaims(ctx)
	if claims == nil {
		return ctx.JSON(http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
	}

	var body VerificationRequest
	if err := ctx.Bind(&body); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid request body"})
	}

	userID, _ := uuid.Parse(claims.UserID)

	reason := pgtype.Text{}
	if body.RejectionReason != nil {
		reason = pgtype.Text{String: *body.RejectionReason, Valid: true}
	}

	_, err := h.queries.VerifyDocument(ctx.Request().Context(), db.VerifyDocumentParams{
		VerificationStatus: pgtype.Text{String: string(body.Status), Valid: true},
		VerifiedBy:         uuidToPgUUID(userID),
		RejectionReason:    reason,
		ID:                 uuidToPgUUID(uuid.UUID(id)),
	})

	if err != nil {
		slog.Error("VerifyDocument failed", "error", fmt.Errorf("verify document: %w", err))
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to record verification"})
	}

	h.activity.Log(ctx.Request().Context(), userID, "VERIFY_DOCUMENT", "document", ptr(uuid.UUID(id)), map[string]interface{}{"status": body.Status}, ctx.RealIP(), ctx.Request().UserAgent())

	return ctx.NoContent(http.StatusOK)
}

func isAllowedKategori(kategori string) bool {
	switch strings.ToUpper(strings.TrimSpace(kategori)) {
	case "KEUANGAN", "FISIK":
		return true
	default:
		return false
	}
}

func isAllowedJenisDokumen(kategori, jenis string) bool {
	k := strings.ToUpper(strings.TrimSpace(kategori))
	j := strings.ToUpper(strings.TrimSpace(jenis))
	if k == "FISIK" {
		return j == "FOTO"
	}
	if k == "KEUANGAN" {
		return j == "DOKUMEN"
	}
	return false
}

func isAllowedUploadMime(kategori, filename, detectedMime string, header []byte) bool {
	k := strings.ToUpper(strings.TrimSpace(kategori))
	ext := strings.ToLower(filepath.Ext(filename))
	m := strings.ToLower(strings.TrimSpace(detectedMime))

	if k == "FISIK" {
		return m == "image/jpeg" || m == "image/png"
	}

	switch m {
	case "application/pdf":
		return true
	case "text/csv":
		return ext == ".csv"
	case "text/plain":
		return ext == ".csv"
	case "application/zip":
		return ext == ".docx" || ext == ".xlsx" || ext == ".pptx"
	}

	if len(header) >= 8 && header[0] == 0xD0 && header[1] == 0xCF && header[2] == 0x11 && header[3] == 0xE0 && header[4] == 0xA1 && header[5] == 0xB1 && header[6] == 0x1A && header[7] == 0xE1 {
		return ext == ".doc" || ext == ".xls" || ext == ".ppt"
	}

	return false
}
