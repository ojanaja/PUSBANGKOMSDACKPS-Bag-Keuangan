package handlers

import (
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	authmw "github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/api/middleware"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func (h *Handler) ListPaket(ctx echo.Context, params ListPaketParams) error {
	tahun := int32(0)
	if params.Tahun != nil {
		tahun = int32(*params.Tahun)
	}

	limit := int32(50)
	offset := int32(0)
	if v := ctx.QueryParam("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = int32(n)
		}
	}
	if v := ctx.QueryParam("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			offset = int32(n)
		}
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}

	pakets, err := h.queries.GetComplianceMatrixPaged(ctx.Request().Context(), db.GetComplianceMatrixPagedParams{
		TahunAnggaran: tahun,
		Limit:         limit,
		Offset:        offset,
	})
	if err != nil {
		slog.Error("GetComplianceMatrixPaged failed", "error", err, "tahun", tahun, "limit", limit, "offset", offset)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to list paket compliance"})
	}

	type ComplianceResponse struct {
		ID                string  `json:"ID"`
		NamaPaket         string  `json:"NamaPaket"`
		PaguPaket         string  `json:"PaguPaket"`
		PaguAnggaran      string  `json:"PaguAnggaran"`
		RealisasiAnggaran string  `json:"RealisasiAnggaran"`
		RealisasiFisik    float64 `json:"RealisasiFisik"`
	}

	response := make([]ComplianceResponse, len(pakets))
	for i, p := range pakets {
		idStr := ""
		if p.ID.Valid {
			u := uuidToOpenAPI(p.ID)
			idStr = u.String()
		}

		response[i] = ComplianceResponse{
			ID:                idStr,
			NamaPaket:         p.NamaPaket,
			PaguPaket:         numericToDecimalString(p.PaguPaket),
			PaguAnggaran:      numericToDecimalString(p.PaguAnggaran),
			RealisasiAnggaran: numericToDecimalString(p.RealisasiAnggaran),
			RealisasiFisik:    numericToFloat64(p.RealisasiFisik),
		}
	}

	return ctx.JSON(http.StatusOK, response)
}

func (h *Handler) CreatePaket(ctx echo.Context) error {
	var body CreatePaketJSONRequestBody
	if err := ctx.Bind(&body); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid request body"})
	}

	claims := authmw.GetClaims(ctx)
	if claims == nil {
		return ctx.JSON(http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
	}

	ppkID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "invalid user id in session"})
	}

	reqCtx := ctx.Request().Context()
	tx, err := h.pool.Begin(reqCtx)
	if err != nil {
		slog.Error("Begin tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to create paket"})
	}
	defer func() {
		_ = tx.Rollback(reqCtx)
	}()

	qtx := h.queries.WithTx(tx)

	paguPaket, err := decimalStringToNumeric(body.PaguPaket)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid pagu_paket"})
	}

	paket, err := qtx.InsertPaketPekerjaan(reqCtx, db.InsertPaketPekerjaanParams{
		ID:        newPgUUID(),
		NamaPaket: body.NamaPaket,
		Kasatker:  body.Kasatker,
		Lokasi:    body.Lokasi,
		PaguPaket: paguPaket,
		Status:    "DRAFT",
		PpkID:     uuidToPgUUID(ppkID),
	})
	if err != nil {
		slog.Error("InsertPaketPekerjaan failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to create paket"})
	}

	if body.AkunIds != nil {
		for _, akunID := range *body.AkunIds {
			if err := qtx.InsertPaketAkunMapping(reqCtx, db.InsertPaketAkunMappingParams{
				PaketID: paket.ID,
				AkunID:  uuidToPgUUID(uuid.UUID(akunID)),
			}); err != nil {
				slog.Error("InsertPaketAkunMapping failed", "error", err)
				return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to create paket mappings"})
			}
		}
	}

	if body.Targets != nil {
		for _, t := range *body.Targets {
			if t.Bulan != nil {
				valKeu := float64(0)
				if t.PersenKeuangan != nil {
					valKeu = float64(*t.PersenKeuangan)
				}
				valFis := float64(0)
				if t.PersenFisik != nil {
					valFis = float64(*t.PersenFisik)
				}

				if _, err := qtx.InsertPaketTarget(reqCtx, db.InsertPaketTargetParams{
					ID:             newPgUUID(),
					PaketID:        paket.ID,
					Bulan:          int32(*t.Bulan),
					PersenKeuangan: float64ToNumeric(valKeu),
					PersenFisik:    float64ToNumeric(valFis),
				}); err != nil {
					slog.Error("InsertPaketTarget failed", "error", err)
					return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to create paket targets"})
				}
			}
		}
	}

	if err := tx.Commit(reqCtx); err != nil {
		slog.Error("Commit tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to create paket"})
	}

	h.activity.Log(ctx.Request().Context(), ppkID, "CREATE_PAKET", "paket", ptr(uuid.UUID(paket.ID.Bytes)), map[string]interface{}{"nama": body.NamaPaket}, ctx.RealIP(), ctx.Request().UserAgent())

	return ctx.JSON(http.StatusCreated, paket)
}

func (h *Handler) GetPaket(ctx echo.Context, id openapi_types.UUID) error {
	pgID := uuidToPgUUID(uuid.UUID(id))
	paket, err := h.queries.GetPaketPekerjaanByID(ctx.Request().Context(), pgID)
	if err != nil {
		return ctx.JSON(http.StatusNotFound, map[string]string{"message": "paket not found"})
	}

	targets, err := h.queries.GetPaketTargetsByPaketID(ctx.Request().Context(), pgID)
	if err != nil {
		slog.Error("GetPaketTargetsByPaketID failed", "error", err)
	}

	realisasi, err := h.queries.GetRealisasiFisikByPaketID(ctx.Request().Context(), pgID)
	if err != nil {
		slog.Error("GetRealisasiFisikByPaketID failed", "error", err)
	}

	var paketID string
	if paket.ID.Valid {
		u, _ := uuid.FromBytes(paket.ID.Bytes[:])
		paketID = u.String()
	}
	paketRes := map[string]interface{}{
		"ID":        paketID,
		"NamaPaket": paket.NamaPaket,
		"Kasatker":  paket.Kasatker,
		"Lokasi":    paket.Lokasi,
		"PaguPaket": numericToDecimalString(paket.PaguPaket),
		"Status":    paket.Status,
	}

	targetsRes := make([]map[string]interface{}, len(targets))
	for i, t := range targets {
		targetsRes[i] = map[string]interface{}{
			"Bulan":          t.Bulan,
			"PersenKeuangan": numericToFloat64(t.PersenKeuangan),
			"PersenFisik":    numericToFloat64(t.PersenFisik),
		}
	}

	realisasiRes := make([]map[string]interface{}, len(realisasi))
	for i, r := range realisasi {
		rID := ""
		if r.ID.Valid {
			u, _ := uuid.FromBytes(r.ID.Bytes[:])
			rID = u.String()
		}
		realisasiRes[i] = map[string]interface{}{
			"ID":                 rID,
			"Bulan":              r.Bulan,
			"PersenAktual":       numericToFloat64(r.PersenAktual),
			"CatatanKendala":     "",
			"VerificationStatus": "",
			"RejectionReason":    "",
			"VerifiedByFullName": "",
		}
		if r.CatatanKendala.Valid {
			realisasiRes[i]["CatatanKendala"] = r.CatatanKendala.String
		}
		if r.VerificationStatus.Valid {
			realisasiRes[i]["VerificationStatus"] = r.VerificationStatus.String
		}
		if r.RejectionReason.Valid {
			realisasiRes[i]["RejectionReason"] = r.RejectionReason.String
		}
		if r.VerifiedByFullName.Valid {
			realisasiRes[i]["VerifiedByFullName"] = r.VerifiedByFullName.String
		}
	}

	return ctx.JSON(http.StatusOK, map[string]interface{}{
		"paket":     paketRes,
		"targets":   targetsRes,
		"realisasi": realisasiRes,
	})
}

func (h *Handler) UpdatePaket(ctx echo.Context, id openapi_types.UUID) error {
	var body UpdatePaketJSONRequestBody
	if err := ctx.Bind(&body); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid request body"})
	}

	pgID := uuidToPgUUID(uuid.UUID(id))

	params := db.UpdatePaketPekerjaanParams{ID: pgID}
	if body.NamaPaket != nil {
		params.NamaPaket = pgtype.Text{String: *body.NamaPaket, Valid: true}
	}
	if body.Kasatker != nil {
		params.Kasatker = pgtype.Text{String: *body.Kasatker, Valid: true}
	}
	if body.Lokasi != nil {
		params.Lokasi = pgtype.Text{String: *body.Lokasi, Valid: true}
	}
	if body.PaguPaket != nil {
		paguPaket, err := decimalStringToNumeric(*body.PaguPaket)
		if err != nil {
			return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid pagu_paket"})
		}
		params.PaguPaket = paguPaket
	}

	err := h.queries.UpdatePaketPekerjaan(ctx.Request().Context(), params)
	if err != nil {
		slog.Error("UpdatePaketPekerjaan failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to update paket"})
	}

	claims := authmw.GetClaims(ctx)
	if claims != nil {
		userID, _ := uuid.Parse(claims.UserID)
		h.activity.Log(ctx.Request().Context(), userID, "UPDATE_PAKET", "paket", ptr(uuid.UUID(id)), map[string]interface{}{"nama": body.NamaPaket}, ctx.RealIP(), ctx.Request().UserAgent())
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "paket updated successfully"})
}

func (h *Handler) DeletePaket(ctx echo.Context, id openapi_types.UUID) error {
	pgID := uuidToPgUUID(uuid.UUID(id))

	err := h.queries.DeletePaketAkunMappingByPaket(ctx.Request().Context(), pgID)
	if err != nil {
		slog.Error("DeletePaketAkunMappingByPaket failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to delete paket mappings"})
	}

	err = h.queries.DeletePaketPekerjaan(ctx.Request().Context(), pgID)
	if err != nil {
		slog.Error("DeletePaketPekerjaan failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to delete paket"})
	}

	claims := authmw.GetClaims(ctx)
	if claims != nil {
		userID, _ := uuid.Parse(claims.UserID)
		h.activity.Log(ctx.Request().Context(), userID, "DELETE_PAKET", "paket", ptr(uuid.UUID(id)), nil, ctx.RealIP(), ctx.Request().UserAgent())
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "paket deleted successfully"})
}

func (h *Handler) GetDocumentsByPaket(ctx echo.Context, id openapi_types.UUID, params GetDocumentsByPaketParams) error {
	pgID := uuidToPgUUID(uuid.UUID(id))

	if params.Bulan != nil {
		docs, err := h.queries.GetDocumentsByPaketAndBulan(ctx.Request().Context(), db.GetDocumentsByPaketAndBulanParams{
			PaketID: pgID,
			Bulan:   int32(*params.Bulan),
		})
		if err != nil {
			return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to get documents"})
		}
		return ctx.JSON(http.StatusOK, docs)
	}

	docs, err := h.queries.GetDocumentsByPaket(ctx.Request().Context(), pgID)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to get documents"})
	}
	return ctx.JSON(http.StatusOK, docs)
}

func (h *Handler) UpdateRealisasiFisik(ctx echo.Context, id openapi_types.UUID) error {
	var body UpdateRealisasiFisikJSONRequestBody
	if err := ctx.Bind(&body); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid request body"})
	}

	claims := authmw.GetClaims(ctx)
	if claims == nil {
		return ctx.JSON(http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
	}

	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "invalid user id"})
	}

	var catatan pgtype.Text
	if body.CatatanKendala != nil {
		catatan = pgtype.Text{String: *body.CatatanKendala, Valid: true}
	}

	_, err = h.queries.UpsertRealisasiFisik(ctx.Request().Context(), db.UpsertRealisasiFisikParams{
		ID:             newPgUUID(),
		PaketID:        uuidToPgUUID(uuid.UUID(id)),
		Bulan:          int32(body.Bulan),
		PersenAktual:   float64ToNumeric(float64(body.PersenAktual)),
		CatatanKendala: catatan,
		UpdatedBy:      uuidToPgUUID(userID),
	})
	if err != nil {
		slog.Error("UpsertRealisasiFisik failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to update realisasi fisik"})
	}

	h.activity.Log(ctx.Request().Context(), userID, "UPDATE_REALISASI", "paket", ptr(uuid.UUID(id)), map[string]interface{}{"bulan": body.Bulan, "persen": body.PersenAktual}, ctx.RealIP(), ctx.Request().UserAgent())

	return ctx.JSON(http.StatusOK, map[string]string{"message": "realisasi fisik updated"})
}

func (h *Handler) VerifyRealisasiFisik(ctx echo.Context, id openapi_types.UUID) error {
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

	_, err := h.queries.VerifyRealisasiFisik(ctx.Request().Context(), db.VerifyRealisasiFisikParams{
		VerificationStatus: pgtype.Text{String: string(body.Status), Valid: true},
		VerifiedBy:         uuidToPgUUID(userID),
		RejectionReason:    reason,
		ID:                 uuidToPgUUID(uuid.UUID(id)),
	})

	if err != nil {
		slog.Error("VerifyRealisasiFisik failed", "error", fmt.Errorf("verify realisasi: %w", err))
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to record verification"})
	}

	h.activity.Log(ctx.Request().Context(), userID, "VERIFY_REALISASI", "realisasi", ptr(uuid.UUID(id)), map[string]interface{}{"status": body.Status}, ctx.RealIP(), ctx.Request().UserAgent())

	return ctx.NoContent(http.StatusOK)
}
