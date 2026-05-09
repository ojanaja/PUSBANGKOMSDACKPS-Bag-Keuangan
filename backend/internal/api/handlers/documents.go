package handlers

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func (h *Handler) DownloadDocument(ctx echo.Context, id openapi_types.UUID) error {
	pgId := uuidToPgUUID(uuid.UUID(id))

	var fileHashSha256 string
	var mimeType string
	var originalName string

	doc, err := h.queries.GetDocumentByID(ctx.Request().Context(), pgId)
	if err == nil {
		fileHashSha256 = doc.FileHashSha256
		mimeType = doc.MimeType
		originalName = doc.OriginalName
	} else {
		anggaranDoc, aErr := h.queries.GetAnggaranDokumenByID(ctx.Request().Context(), pgId)
		if aErr == nil {
			fileHashSha256 = anggaranDoc.FileHashSha256
			mimeType = anggaranDoc.MimeType
			originalName = anggaranDoc.OriginalName
		} else {
			dipaDoc, dErr := h.queries.GetDipaDokumenByID(ctx.Request().Context(), pgId)
			if dErr == nil {
				fileHashSha256 = dipaDoc.FileHashSha256
				mimeType = dipaDoc.MimeType
				originalName = dipaDoc.OriginalName
			} else {
				slog.Error("Document not found in any table", "id", id, "err_doc", err, "err_anggaran", aErr, "err_dipa", dErr)
				return ctx.JSON(http.StatusNotFound, map[string]string{"message": "document not found"})
			}
		}
	}

	disposition := "inline"
	if ctx.QueryParam("download") == "true" {
		disposition = fmt.Sprintf("attachment; filename=%q", originalName)
	}

	err = h.cas.Download(fileHashSha256, ctx.Response().Writer, func() {
		ctx.Response().Header().Set(echo.HeaderContentType, mimeType)
		ctx.Response().Header().Set(echo.HeaderContentDisposition, disposition)
		ctx.Response().WriteHeader(http.StatusOK)
	})

	if err != nil {
		if h.cas.IsNotFoundError(err) {
			slog.Error("File missing in CAS", "hash", fileHashSha256)
			return ctx.JSON(http.StatusNotFound, map[string]string{"message": "file content not found"})
		}
		slog.Error("Failed to download document", "hash", fileHashSha256, "err", err)
		return err // Note: Status might already be sent if error happened mid-stream
	}

	return nil
}

func (h *Handler) UploadDocument(ctx echo.Context) error {
	return ctx.JSON(http.StatusNotImplemented, map[string]string{"message": "UploadDocument is deprecated. Use UploadBuktiAnggaran instead."})
}

func (h *Handler) VerifyDocument(ctx echo.Context, id openapi_types.UUID) error {
	return ctx.JSON(http.StatusNotImplemented, map[string]string{"message": "VerifyDocument is deactivated."})
}

func (h *Handler) UpdateDocumentName(ctx echo.Context, id openapi_types.UUID) error {
	var body UpdateDocumentNameJSONRequestBody
	if err := ctx.Bind(&body); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid request body"})
	}

	pgId := uuidToPgUUID(uuid.UUID(id))

	if body.OriginalName == "" {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "original_name is required"})
	}

	// Update the name using our newly generated SQL query
	_, err := h.queries.UpdateAnggaranDokumenName(ctx.Request().Context(), db.UpdateAnggaranDokumenNameParams{
		OriginalName: body.OriginalName,
		ID:           pgId,
	})
	if err != nil {
		slog.Error("Failed to update document name", "id", id, "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to update document"})
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "document updated successfully"})
}

func (h *Handler) DeleteDocument(ctx echo.Context, id openapi_types.UUID) error {
	pgId := uuidToPgUUID(uuid.UUID(id))

	// First try to check if the document exists in anggaran_dokumen_bukti before deleting
	_, err := h.queries.GetAnggaranDokumenByID(ctx.Request().Context(), pgId)
	if err != nil {
		// Possibly standard document, try deleting from standard table
		_ = h.queries.DeleteDocument(ctx.Request().Context(), pgId)
		return ctx.JSON(http.StatusOK, map[string]string{"message": "document deleted successfully"})
	}

	// It's an anggaran dokumen, let's delete
	err = h.queries.DeleteAnggaranDokumen(ctx.Request().Context(), pgId)
	if err != nil {
		slog.Error("Failed to delete document from db", "id", id, "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to delete document"})
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "document deleted successfully"})
}
