package handlers

import (
	"fmt"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strconv"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/services"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
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
