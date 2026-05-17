package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

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
	filenameLower := strings.ToLower(file.Filename)
	if !strings.HasSuffix(filenameLower, ".xls") && !strings.HasSuffix(filenameLower, ".xlsx") {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "Only Excel (.xls, .xlsx) files are allowed"})
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

		source := ctx.FormValue("source")
		if source == "" {
			source = "fa_detail"
		}

		var insertedID pgtype.UUID
		err := tx.QueryRow(reqCtx, `
            INSERT INTO anggaran_node (
                id, parent_id, jenis, kode, uraian, tahun_anggaran, 
                pagu_revisi, lock_pagu, realisasi_periode_lalu, realisasi_periode_ini, 
                realisasi_sd_periode, persentase_realisasi, sisa_anggaran, source
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
            ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), kode, source) DO UPDATE SET
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
			mustDecimalNumeric(node.Sisa), source,
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

// PreviewAnggaranImport parses an Excel file and returns the tree preview without saving to DB.
func (h *Handler) PreviewAnggaranImport(ctx echo.Context) error {
	file, err := ctx.FormFile("file")
	if err != nil {
		slog.Error("PreviewAnggaranImport 400", "reason", "ctx.FormFile failed", "error", err)
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "file is required"})
	}
	filenameLower := strings.ToLower(file.Filename)
	if !strings.HasSuffix(filenameLower, ".xls") && !strings.HasSuffix(filenameLower, ".xlsx") {
		slog.Error("PreviewAnggaranImport 400", "reason", "invalid extension", "filename", filenameLower)
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "Only Excel (.xls, .xlsx) files are allowed"})
	}

	src, err := openMultipartFile(file)
	if err != nil {
		slog.Error("PreviewAnggaranImport 500", "reason", "openMultipartFile failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to open file"})
	}
	defer src.Close()

	nodes, format, err := services.DetectAndParseExcel(src)
	if err != nil {
		slog.Error("PreviewAnggaranImport 400", "reason", "DetectAndParseExcel failed", "error", err)
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": fmt.Sprintf("Parse error: %s", err)})
	}

	if len(nodes) == 0 {
		slog.Error("PreviewAnggaranImport 400", "reason", "no nodes found in excel")
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "No data could be parsed from the file"})
	}

	// Build preview response with temp IDs
	type PreviewNode struct {
		TempID        string `json:"temp_id"`
		ParentTempID  string `json:"parent_temp_id"`
		Level         int    `json:"level"`
		Jenis         string `json:"jenis"`
		Kode          string `json:"kode"`
		Uraian        string `json:"uraian"`
		PaguRevisi    string `json:"pagu_revisi"`
		LockPagu      string `json:"lock_pagu"`
		RealisasiLalu string `json:"realisasi_lalu"`
		RealisasiIni  string `json:"realisasi_ini"`
		RealisasiSD   string `json:"realisasi_sd"`
		Persentase    string `json:"persentase"`
		Sisa          string `json:"sisa"`
	}

	previewNodes := make([]PreviewNode, 0, len(nodes))
	// Track temp_id for each level to build parent references
	var levelTempIDs [20]string

	jenisCounts := make(map[string]int)

	for i, node := range nodes {
		tempID := fmt.Sprintf("temp-%d", i)

		parentTempID := ""
		if node.ParentLevel >= 0 {
			parentTempID = levelTempIDs[node.ParentLevel]
		}

		previewNodes = append(previewNodes, PreviewNode{
			TempID:        tempID,
			ParentTempID:  parentTempID,
			Level:         node.Level,
			Jenis:         node.Jenis,
			Kode:          node.Kode,
			Uraian:        node.Uraian,
			PaguRevisi:    node.PaguRevisi,
			LockPagu:      node.LockPagu,
			RealisasiLalu: node.RealisasiLalu,
			RealisasiIni:  node.RealisasiIni,
			RealisasiSD:   node.RealisasiSD,
			Persentase:    node.Persentase,
			Sisa:          node.Sisa,
		})

		levelTempIDs[node.Level] = tempID
		for j := node.Level + 1; j < 20; j++ {
			levelTempIDs[j] = ""
		}

		jenisCounts[node.Jenis]++
	}

	return ctx.JSON(http.StatusOK, map[string]interface{}{
		"format_detected": string(format),
		"nodes":           previewNodes,
		"stats": map[string]interface{}{
			"total_nodes": len(previewNodes),
			"by_jenis":    jenisCounts,
		},
	})
}

// ConfirmAnggaranImport accepts a JSON tree (from preview) and saves it to the database.
func (h *Handler) ConfirmAnggaranImport(ctx echo.Context) error {
	type ConfirmNode struct {
		TempID        string `json:"temp_id"`
		ParentTempID  string `json:"parent_temp_id"`
		Level         int    `json:"level"`
		Jenis         string `json:"jenis"`
		Kode          string `json:"kode"`
		Uraian        string `json:"uraian"`
		PaguRevisi    string `json:"pagu_revisi"`
		LockPagu      string `json:"lock_pagu"`
		RealisasiLalu string `json:"realisasi_lalu"`
		RealisasiIni  string `json:"realisasi_ini"`
		RealisasiSD   string `json:"realisasi_sd"`
		Persentase    string `json:"persentase"`
		Sisa          string `json:"sisa"`
	}

	type ConfirmPayload struct {
		TahunAnggaran int           `json:"tahun_anggaran"`
		Source        string        `json:"source"`
		Nodes         []ConfirmNode `json:"nodes"`
	}
	var payload ConfirmPayload
	if err := json.NewDecoder(ctx.Request().Body).Decode(&payload); err != nil {
		slog.Error("ConfirmAnggaranImport 400", "reason", "invalid JSON body", "error", err)
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid JSON body"})
	}

	if payload.TahunAnggaran == 0 {
		slog.Error("ConfirmAnggaranImport 400", "reason", "tahun_anggaran is 0")
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "tahun_anggaran is required"})
	}

	if len(payload.Nodes) == 0 {
		slog.Error("ConfirmAnggaranImport 400", "reason", "no nodes provided")
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "no nodes provided"})
	}

	reqCtx := ctx.Request().Context()
	tx, err := h.pool.Begin(reqCtx)
	if err != nil {
		slog.Error("Begin tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to import data"})
	}
	defer func() {
		_ = tx.Rollback(reqCtx)
	}()

	// Map temp_id → real UUID
	tempToReal := make(map[string]pgtype.UUID)
	nodeCount := 0

	for _, node := range payload.Nodes {
		parentID := pgtype.UUID{Valid: false}
		if node.ParentTempID != "" {
			if realParent, ok := tempToReal[node.ParentTempID]; ok {
				parentID = realParent
			}
		}

		var insertedID pgtype.UUID

		source := "fa_detail"
		if payload.Source != "" {
			source = payload.Source
		}

		err := tx.QueryRow(reqCtx, `
                        INSERT INTO anggaran_node (
                                id, parent_id, jenis, kode, uraian, tahun_anggaran,
                                pagu_revisi, lock_pagu, realisasi_periode_lalu, realisasi_periode_ini,
                                realisasi_sd_periode, persentase_realisasi, sisa_anggaran, source
                        ) VALUES (
                                gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
                        )
                        ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), kode, source) DO UPDATE SET
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
			parentID, node.Jenis, node.Kode, node.Uraian, payload.TahunAnggaran,
			mustDecimalNumeric(node.PaguRevisi), mustDecimalNumeric(node.LockPagu),
			mustDecimalNumeric(node.RealisasiLalu), mustDecimalNumeric(node.RealisasiIni),
			mustDecimalNumeric(node.RealisasiSD), mustDecimalNumeric(node.Persentase),
			mustDecimalNumeric(node.Sisa), source).Scan(&insertedID)

		if err != nil {
			slog.Error("upsert node failed", "error", err, "kode", node.Kode)
			return ctx.JSON(http.StatusInternalServerError, map[string]string{
				"message": fmt.Sprintf("Failed to save node %s: %s", node.Kode, err),
			})
		}

		tempToReal[node.TempID] = insertedID
		nodeCount++
	}

	if err := tx.Commit(reqCtx); err != nil {
		slog.Error("Commit tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to import data"})
	}

	return ctx.JSON(http.StatusOK, map[string]interface{}{
		"nodes_upserted": nodeCount,
	})
}

func mustDecimalNumeric(s string) pgtype.Numeric {
	n, err := decimalStringToNumeric(s)
	if err != nil {
		return float64ToNumeric(0)
	}
	return n
}

func (h *Handler) GetAnggaranTree(ctx echo.Context, params GetAnggaranTreeParams) error {
	tahun := pgtype.Int4{Int32: int32(params.Tahun), Valid: true}

	sourceFilter := "fa_detail"
	if params.Source != nil && *params.Source != "" {
		sourceFilter = *params.Source
	}

	// If a snapshot periode is specified, fetch from history table
	if params.Periode != nil && *params.Periode != "" {
		rows, err := h.queries.GetAnggaranHistoryTree(ctx.Request().Context(), db.GetAnggaranHistoryTreeParams{
			TahunAnggaran:   tahun,
			SnapshotPeriode: *params.Periode,
			Column3:         sourceFilter,
		})
		if err != nil {
			slog.Error("GetAnggaranHistoryTree failed", "error", err)
			return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to retrieve Anggaran history tree"})
		}
		return ctx.JSON(http.StatusOK, rows)
	}

	// Default: fetch live data
	rows, err := h.queries.GetAnggaranTree(ctx.Request().Context(), db.GetAnggaranTreeParams{
		TahunAnggaran: tahun,
		Column2:       sourceFilter,
	})
	if err != nil {
		slog.Error("GetAnggaranTree failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to retrieve Anggaran tree"})
	}
	return ctx.JSON(http.StatusOK, rows)
}

func (h *Handler) GetAnggaranSnapshots(ctx echo.Context, params GetAnggaranSnapshotsParams) error {
	tahun := pgtype.Int4{Int32: int32(params.Tahun), Valid: true}
	snapshots, err := h.queries.GetAvailableSnapshots(ctx.Request().Context(), tahun)
	if err != nil {
		slog.Error("GetAvailableSnapshots failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to retrieve snapshots"})
	}
	if snapshots == nil {
		snapshots = []string{}
	}
	return ctx.JSON(http.StatusOK, snapshots)
}

func (h *Handler) UpdateAnggaranNode(ctx echo.Context, id types.UUID) error {
	var req UpdateAnggaranRequest
	if err := ctx.Bind(&req); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid request body"})
	}

	reqCtx := ctx.Request().Context()
	tx, err := h.pool.Begin(reqCtx)
	if err != nil {
		slog.Error("Begin tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to begin transaction"})
	}
	defer func() {
		_ = tx.Rollback(reqCtx)
	}()

	var paguRevisi pgtype.Numeric
	paguRevisi.Valid = false
	if req.PaguRevisi != nil {
		paguRevisi = mustDecimalNumeric(*req.PaguRevisi)
	}

	var realisasiIni pgtype.Numeric
	realisasiIni.Valid = false
	if req.RealisasiPeriodeIni != nil {
		realisasiIni = mustDecimalNumeric(*req.RealisasiPeriodeIni)
	}

	var realisasiLalu pgtype.Numeric
	realisasiLalu.Valid = false
	if req.RealisasiPeriodeLalu != nil {
		realisasiLalu = mustDecimalNumeric(*req.RealisasiPeriodeLalu)
	}

	nodeID := uuidToPgUUID(uuid.UUID(id))

	_, err = tx.Exec(reqCtx, `
		UPDATE anggaran_node 
		SET pagu_revisi = COALESCE($1, pagu_revisi),
			realisasi_periode_ini = COALESCE($2, realisasi_periode_ini),
			realisasi_periode_lalu = COALESCE($3, realisasi_periode_lalu)
		WHERE id = $4
	`, paguRevisi, realisasiIni, realisasiLalu, nodeID)
	if err != nil {
		slog.Error("Update node failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to update node"})
	}

	currNode := nodeID
	for {
		_, err = tx.Exec(reqCtx, `
			UPDATE anggaran_node
			SET realisasi_sd_periode = realisasi_periode_lalu + realisasi_periode_ini,
				sisa_anggaran = pagu_revisi - (realisasi_periode_lalu + realisasi_periode_ini),
				persentase_realisasi = CASE 
					WHEN pagu_revisi > 0 THEN ((realisasi_periode_lalu + realisasi_periode_ini) / pagu_revisi) * 100 
					ELSE 0 END
			WHERE id = $1
		`, currNode)
		if err != nil {
			slog.Error("Recalculate fields failed", "error", err)
			return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to recalculate node"})
		}

		var parentID pgtype.UUID
		err = tx.QueryRow(reqCtx, `SELECT parent_id FROM anggaran_node WHERE id = $1`, currNode).Scan(&parentID)
		if err != nil || !parentID.Valid {
			break
		}

		_, err = tx.Exec(reqCtx, `
			UPDATE anggaran_node p
			SET pagu_revisi = (SELECT COALESCE(SUM(pagu_revisi), 0) FROM anggaran_node WHERE parent_id = p.id),
				realisasi_periode_lalu = (SELECT COALESCE(SUM(realisasi_periode_lalu), 0) FROM anggaran_node WHERE parent_id = p.id),
				realisasi_periode_ini = (SELECT COALESCE(SUM(realisasi_periode_ini), 0) FROM anggaran_node WHERE parent_id = p.id)
			WHERE p.id = $1
		`, parentID)
		if err != nil {
			slog.Error("Rollup parent failed", "error", err)
			return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to rollup parent node"})
		}

		currNode = parentID
	}

	if err := tx.Commit(reqCtx); err != nil {
		slog.Error("Commit tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to update data"})
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "Anggaran updated successfully"})
}

func (h *Handler) DeleteAnggaranNode(ctx echo.Context, id types.UUID) error {
	reqCtx := ctx.Request().Context()
	tx, err := h.pool.Begin(reqCtx)
	if err != nil {
		slog.Error("Begin tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to begin transaction"})
	}
	defer func() {
		_ = tx.Rollback(reqCtx)
	}()

	nodeID := uuidToPgUUID(uuid.UUID(id))

	// Get parent before deleting to know where to rollup
	var parentID pgtype.UUID
	err = tx.QueryRow(reqCtx, `SELECT parent_id FROM anggaran_node WHERE id = $1`, nodeID).Scan(&parentID)
	if err != nil {
		slog.Error("Failed to get parent node for deletion", "error", err)
		return ctx.JSON(http.StatusNotFound, map[string]string{"message": "node not found"})
	}

	_, err = tx.Exec(reqCtx, `DELETE FROM anggaran_node WHERE id = $1`, nodeID)
	if err != nil {
		slog.Error("Delete node failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to delete node"})
	}

	currNode := parentID
	for currNode.Valid {
		var nextParentID pgtype.UUID
		err = tx.QueryRow(reqCtx, `SELECT parent_id FROM anggaran_node WHERE id = $1`, currNode).Scan(&nextParentID)
		if err != nil {
			break
		}

		_, err = tx.Exec(reqCtx, `
			UPDATE anggaran_node p
			SET pagu_revisi = (SELECT COALESCE(SUM(pagu_revisi), 0) FROM anggaran_node WHERE parent_id = p.id),
				lock_pagu = (SELECT COALESCE(SUM(lock_pagu), 0) FROM anggaran_node WHERE parent_id = p.id),
				realisasi_periode_lalu = (SELECT COALESCE(SUM(realisasi_periode_lalu), 0) FROM anggaran_node WHERE parent_id = p.id),
				realisasi_periode_ini = (SELECT COALESCE(SUM(realisasi_periode_ini), 0) FROM anggaran_node WHERE parent_id = p.id)
			WHERE p.id = $1
		`, currNode)
		if err != nil {
			slog.Error("Rollup parent failed", "error", err)
			return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to rollup parent node"})
		}

		currNode = nextParentID
	}

	if err := tx.Commit(reqCtx); err != nil {
		slog.Error("Commit tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to update data"})
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "Anggaran deleted successfully"})
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

	result, err := h.cas.Save(src, file.Filename)
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
			"uploaded_by":      uuid.UUID(r.UploadedBy.Bytes).String(),
			"uploaded_by_name": r.UploadedByName,
		}
	}

	return ctx.JSON(http.StatusOK, result)
}

func (h *Handler) UpdateLockPagu(ctx echo.Context, id types.UUID) error {
	var req UpdateLockPaguRequest
	if err := ctx.Bind(&req); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid request body"})
	}

	reqCtx := ctx.Request().Context()
	tx, err := h.pool.Begin(reqCtx)
	if err != nil {
		slog.Error("Begin tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to begin transaction"})
	}
	defer func() {
		_ = tx.Rollback(reqCtx)
	}()

	lockPagu := mustDecimalNumeric(req.LockPagu)
	nodeID := uuidToPgUUID(uuid.UUID(id))

	_, err = tx.Exec(reqCtx, `
		UPDATE anggaran_node 
		SET lock_pagu = $1
		WHERE id = $2
	`, lockPagu, nodeID)
	if err != nil {
		slog.Error("UpdateLockPagu failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to update lock pagu"})
	}

	currNode := nodeID
	for {
		var parentID pgtype.UUID
		err = tx.QueryRow(reqCtx, `SELECT parent_id FROM anggaran_node WHERE id = $1`, currNode).Scan(&parentID)
		if err != nil || !parentID.Valid {
			break
		}

		_, err = tx.Exec(reqCtx, `
			UPDATE anggaran_node p
			SET lock_pagu = (SELECT COALESCE(SUM(lock_pagu), 0) FROM anggaran_node WHERE parent_id = p.id)
			WHERE p.id = $1
		`, parentID)
		if err != nil {
			slog.Error("Rollup lock_pagu failed", "error", err)
			return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to rollup parent node"})
		}

		currNode = parentID
	}

	if err := tx.Commit(reqCtx); err != nil {
		slog.Error("Commit tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to update data"})
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "Lock Pagu updated successfully"})
}

func (h *Handler) CreateAnggaranSnapshot(ctx echo.Context) error {
	var req SnapshotRequest
	if err := ctx.Bind(&req); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid request body"})
	}

	if req.Periode == "" {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "periode is required"})
	}

	// First, delete any existing snapshot for this period
	if err := h.queries.DeleteAnggaranSnapshot(ctx.Request().Context(), req.Periode); err != nil {
		slog.Error("DeleteAnggaranSnapshot failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to clear existing snapshot"})
	}

	if err := h.queries.CreateAnggaranSnapshot(ctx.Request().Context(), req.Periode); err != nil {
		slog.Error("CreateAnggaranSnapshot failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to create snapshot"})
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "Snapshot created successfully"})
}

func (h *Handler) RolloverAnggaran(ctx echo.Context) error {
	reqCtx := ctx.Request().Context()
	tx, err := h.pool.Begin(reqCtx)
	if err != nil {
		slog.Error("Begin tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to begin transaction"})
	}
	defer func() {
		_ = tx.Rollback(reqCtx)
	}()

	// Perform rollover:
	// 1. realisasi_periode_lalu = realisasi_sd_periode
	// 2. realisasi_periode_ini = 0
	// (sisa_anggaran and realisasi_sd_periode don't need update since they depend on realisasi_periode_ini + realisasi_periode_lalu, 
	// but we should just set them mathematically to be safe).
	_, err = tx.Exec(reqCtx, `
		UPDATE anggaran_node
		SET realisasi_periode_lalu = realisasi_sd_periode,
		    realisasi_periode_ini = 0,
		    sisa_anggaran = pagu_revisi - realisasi_sd_periode
	`)
	if err != nil {
		slog.Error("Rollover update failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to rollover data"})
	}

	if err := tx.Commit(reqCtx); err != nil {
		slog.Error("Commit tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to save rollover data"})
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "Tutup bulan berhasil dilakukan"})
}
