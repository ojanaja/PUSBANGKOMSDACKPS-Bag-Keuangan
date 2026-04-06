package handlers

import (
	"fmt"
	"log/slog"
	"net/http"

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
			slog.Error("Document not found in both tables", "id", id, "err_doc", err, "err_anggaran", aErr)
			return ctx.JSON(http.StatusNotFound, map[string]string{"message": "document not found"})
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
