package handlers

import (
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	authmw "github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/api/middleware"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func (h *Handler) UploadDipaDokumen(ctx echo.Context) error {
	file, err := ctx.FormFile("file")
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "file is required"})
	}

	// Validate PDF
	filenameLower := strings.ToLower(file.Filename)
	if !strings.HasSuffix(filenameLower, ".pdf") {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "Only PDF files are allowed"})
	}

	tahunStr := ctx.FormValue("tahun_anggaran")
	tahun, err := strconv.Atoi(tahunStr)
	if err != nil || tahun < 2000 {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "tahun_anggaran must be a valid year"})
	}

	bulanStr := ctx.FormValue("bulan")
	bulan, err := strconv.Atoi(bulanStr)
	if err != nil || bulan < 1 || bulan > 12 {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "bulan must be between 1 and 12"})
	}

	revisiStr := ctx.FormValue("revisi")
	revisi, err := strconv.Atoi(revisiStr)
	if err != nil || revisi < 0 {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "revisi must be a non-negative integer"})
	}

	// Sniff MIME type
	sniff, err := openMultipartFile(file)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to open file"})
	}
	header := make([]byte, 512)
	n, _ := sniff.Read(header)
	_ = sniff.Close()
	mimeType := http.DetectContentType(header[:n])

	// Save to CAS
	src, err := openMultipartFile(file)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to open file"})
	}
	defer src.Close()

	result, err := h.cas.Save(src, file.Filename)
	if err != nil {
		slog.Error("CAS save failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to save file"})
	}

	// Get current user
	claims := authmw.GetClaims(ctx)
	if claims == nil {
		return ctx.JSON(http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
	}
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "invalid user id"})
	}

	docID := newPgUUID()
	doc, err := h.queries.InsertDipaDokumen(ctx.Request().Context(), db.InsertDipaDokumenParams{
		ID:             docID,
		TahunAnggaran:  int32(tahun),
		Bulan:          int32(bulan),
		Revisi:         int32(revisi),
		FileHashSha256: result.Hash,
		OriginalName:   file.Filename,
		MimeType:       mimeType,
		FileSizeBytes:  result.Size,
		UploadedBy:     uuidToPgUUID(userID),
	})
	if err != nil {
		slog.Error("InsertDipaDokumen failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to save metadata"})
	}

	return ctx.JSON(http.StatusOK, map[string]interface{}{
		"message": "Document uploaded successfully",
		"id":      uuid.UUID(doc.ID.Bytes).String(),
	})
}

func (h *Handler) GetDipaDocuments(ctx echo.Context, params GetDipaDocumentsParams) error {
	bulanFilter := int32(0) // 0 means no filter
	if params.Bulan != nil {
		bulanFilter = int32(*params.Bulan)
	}

	revisiFilter := int32(-1) // -1 means no filter
	if params.Revisi != nil {
		revisiFilter = int32(*params.Revisi)
	}

	rows, err := h.queries.GetDipaDocuments(ctx.Request().Context(), db.GetDipaDocumentsParams{
		TahunAnggaran: int32(params.Tahun),
		Column2:       bulanFilter,
		Column3:       revisiFilter,
	})
	if err != nil {
		slog.Error("GetDipaDocuments failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to get documents"})
	}

	result := make([]map[string]interface{}, len(rows))
	for i, r := range rows {
		uploadedByName := ""
		if r.UploadedByName.Valid {
			uploadedByName = r.UploadedByName.String
		}
		result[i] = map[string]interface{}{
			"id":               uuid.UUID(r.ID.Bytes).String(),
			"tahun_anggaran":   r.TahunAnggaran,
			"bulan":            r.Bulan,
			"revisi":           r.Revisi,
			"file_hash_sha256": r.FileHashSha256,
			"original_name":    r.OriginalName,
			"mime_type":        r.MimeType,
			"file_size_bytes":  r.FileSizeBytes,
			"created_at":       r.CreatedAt.Time,
			"uploaded_by":      uuid.UUID(r.UploadedBy.Bytes).String(),
			"uploaded_by_name": uploadedByName,
		}
	}

	return ctx.JSON(http.StatusOK, result)
}

func (h *Handler) DeleteDipaDokumen(ctx echo.Context, id openapi_types.UUID) error {
	pgId := uuidToPgUUID(uuid.UUID(id))

	_, err := h.queries.GetDipaDokumenByID(ctx.Request().Context(), pgId)
	if err != nil {
		return ctx.JSON(http.StatusNotFound, map[string]string{"message": "document not found"})
	}

	err = h.queries.DeleteDipaDokumen(ctx.Request().Context(), pgId)
	if err != nil {
		slog.Error("DeleteDipaDokumen failed", "id", id, "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to delete document"})
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "document deleted successfully"})
}
