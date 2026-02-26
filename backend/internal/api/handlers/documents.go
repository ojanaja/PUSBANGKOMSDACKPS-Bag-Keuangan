package handlers

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	openapi_types "github.com/oapi-codegen/runtime/types"
	authmw "github.com/vandal/keuangan-pusbangkom/internal/api/middleware"
	"github.com/vandal/keuangan-pusbangkom/internal/db"
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

	bulan, err := strconv.Atoi(bulanStr)
	if err != nil || bulan < 1 || bulan > 12 {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "bulan must be 1-12"})
	}

	paketUUID, err := uuid.Parse(paketIDStr)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid paket_id"})
	}

	src, err := file.Open()
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to open file"})
	}
	defer src.Close()

	result, err := h.cas.Save(src)
	if err != nil {
		slog.Error("CAS save failed", "error", err)
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
		slog.Error("InsertDocument failed", "error", err)
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

	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return err
	}

	http.ServeContent(ctx.Response(), ctx.Request(), doc.OriginalName, fi.ModTime(), f)
	return nil
}

func (h *Handler) VerifyDocument(ctx echo.Context, id openapi_types.UUID) error {
	claims := authmw.GetClaims(ctx)
	if claims == nil || (claims.Role != "SUPER_ADMIN" && claims.Role != "ADMIN_KEUANGAN") {
		return ctx.JSON(http.StatusForbidden, map[string]string{"message": "forbidden: verifier role required"})
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
		slog.Error("VerifyDocument failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to record verification"})
	}

	h.activity.Log(ctx.Request().Context(), userID, "VERIFY_DOCUMENT", "document", ptr(uuid.UUID(id)), map[string]interface{}{"status": body.Status}, ctx.RealIP(), ctx.Request().UserAgent())

	return ctx.NoContent(http.StatusOK)
}
