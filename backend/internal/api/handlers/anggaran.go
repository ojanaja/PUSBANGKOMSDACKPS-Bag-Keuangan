package handlers

import (
	"fmt"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strconv"

	authmw "github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/api/middleware"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/services"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	"github.com/oapi-codegen/runtime/types"
)

var openMultipartFile = func(fileHeader *multipart.FileHeader) (multipart.File, error) {
	return fileHeader.Open()
}

func (h *Handler) ImportAnggaranData(ctx echo.Context) error {
	file, err := ctx.FormFile("file")
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "file is required"})
	}
	tahunStr := ctx.FormValue("tahun_anggaran")
	tahun, err := strconv.Atoi(tahunStr)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "tahun_anggaran must be an integer"})
	}

	src, err := openMultipartFile(file)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to open file"})
	}
	defer src.Close()

	reqCtx := ctx.Request().Context()
	tx, err := h.pool.Begin(reqCtx)
	if err != nil {
		slog.Error("Begin tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to import data"})
	}
	defer func() {
		_ = tx.Rollback(reqCtx)
	}()

	if _, err := tx.Exec(reqCtx, `
		-- Removing redundant temp table logic as we will perform upserts natively
	`); err != nil {
	    // ignore	
	}

	nodeCount := 0
	var parentIDs [10]pgtype.UUID

	_, err = services.ParseAnggaranCSVStream(src, func(node services.AnggaranNodeImport) error {
        
        parentID := pgtype.UUID{Valid: false}
        if node.ParentLevel >= 0 {
            parentID = parentIDs[node.ParentLevel]
        }

        var insertedID pgtype.UUID
        err := tx.QueryRow(reqCtx, `
            INSERT INTO anggaran_node (
                id, parent_id, jenis, kode, uraian, tahun_anggaran, 
                pagu_revisi, lock_pagu, realisasi_periode_lalu, realisasi_periode_ini, 
                realisasi_sd_periode, persentase_realisasi, sisa_anggaran
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
            )
            ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), kode) DO UPDATE SET
                uraian = EXCLUDED.uraian,
                pagu_revisi = EXCLUDED.pagu_revisi,
                lock_pagu = EXCLUDED.lock_pagu,
                realisasi_periode_lalu = EXCLUDED.realisasi_periode_lalu,
                realisasi_periode_ini = EXCLUDED.realisasi_periode_ini,
                realisasi_sd_periode = EXCLUDED.realisasi_sd_periode,
                persentase_realisasi = EXCLUDED.persentase_realisasi,
                sisa_anggaran = EXCLUDED.sisa_anggaran
            RETURNING id;
        `, 
            parentID, node.Jenis, node.Kode, node.Uraian, tahun,
            mustDecimalNumeric(node.PaguRevisi), mustDecimalNumeric(node.LockPagu),
            mustDecimalNumeric(node.RealisasiLalu), mustDecimalNumeric(node.RealisasiIni),
            mustDecimalNumeric(node.RealisasiSD), mustDecimalNumeric(node.Persentase),
            mustDecimalNumeric(node.Sisa),
        ).Scan(&insertedID)

        if err != nil {
            slog.Error("upsert node failed", "error", err, "kode", node.Kode)
            return err
        }

        parentIDs[node.Level] = insertedID
		nodeCount++
		return nil
	})
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": fmt.Sprintf("CSV parse error: %s", err)})
	}

	if err := tx.Commit(reqCtx); err != nil {
		slog.Error("Commit tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to import data"})
	}

	return ctx.JSON(http.StatusOK, map[string]interface{}{
		"nodes_upserted": nodeCount,
	})
}

func (h *Handler) CreateManualAnggaran(ctx echo.Context) error {
    return ctx.JSON(http.StatusNotImplemented, map[string]string{"message": "Not implemented anymore for custom tree"})
}

func mustDecimalNumeric(s string) pgtype.Numeric {
	n, err := decimalStringToNumeric(s)
	if err != nil {
		return float64ToNumeric(0)
	}
	return n
}

func (h *Handler) GetAnggaranTree(ctx echo.Context, params GetAnggaranTreeParams) error {
	rows, err := h.queries.GetAnggaranTree(ctx.Request().Context(), pgtype.Int4{Int32: int32(params.Tahun), Valid: true})
	if err != nil {
		slog.Error("GetAnggaranTree failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to retrieve Anggaran tree"})
	}
	return ctx.JSON(http.StatusOK, rows)
}

func (h *Handler) UploadBuktiAnggaran(ctx echo.Context) error {
	file, err := ctx.FormFile("file")
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "file is required"})
	}

	nodeIDStr := ctx.FormValue("node_id")
	if nodeIDStr == "" {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "node_id is required"})
	}

	nodeUUID, err := uuid.Parse(nodeIDStr)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid node_id format"})
	}

	sniff, err := openMultipartFile(file)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to open file"})
	}
	header := make([]byte, 512)
	n, _ := sniff.Read(header)
	_ = sniff.Close()
	mimeType := http.DetectContentType(header[:n])

	src, err := openMultipartFile(file)
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

	_, err = h.queries.InsertAnggaranDokumen(ctx.Request().Context(), db.InsertAnggaranDokumenParams{
		ID:             docID,
		AnggaranNodeID: uuidToPgUUID(nodeUUID),
		FileHashSha256: result.Hash,
		OriginalName:   file.Filename,
		MimeType:       mimeType,
		FileSizeBytes:  result.Size,
		UploadedBy:     uuidToPgUUID(userID),
	})
	if err != nil {
		slog.Error("InsertAnggaranDokumen failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to save metadata"})
	}

	h.activity.Log(ctx.Request().Context(), userID, "UPLOAD_BUKTI_ANGGARAN", "anggaran_dokumen", ptr(uuid.UUID(docID.Bytes)), map[string]interface{}{"filename": file.Filename, "node_id": nodeIDStr}, ctx.RealIP(), ctx.Request().UserAgent())

	return ctx.JSON(http.StatusOK, map[string]string{"message": "Document uploaded successfully"})
}

func (h *Handler) GetAnggaranDokumenByNode(ctx echo.Context, id types.UUID) error {
	rows, err := h.queries.GetAnggaranDokumenByNode(ctx.Request().Context(), uuidToPgUUID(uuid.UUID(id)))
	if err != nil {
		slog.Error("GetAnggaranDokumenByNode failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to get documents"})
	}

	result := make([]map[string]interface{}, len(rows))
	for i, r := range rows {
		result[i] = map[string]interface{}{
			"id":               uuid.UUID(r.ID.Bytes).String(),
			"anggaran_node_id": uuid.UUID(r.AnggaranNodeID.Bytes).String(),
			"file_hash_sha256": r.FileHashSha256,
			"original_name":    r.OriginalName,
			"mime_type":        r.MimeType,
			"file_size_bytes":  r.FileSizeBytes,
			"created_at":       r.CreatedAt.Time,
		}
	}

	return ctx.JSON(http.StatusOK, result)
}
