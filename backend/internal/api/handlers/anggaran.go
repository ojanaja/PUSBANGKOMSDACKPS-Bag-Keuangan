package handlers

import (
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	"github.com/vandal/keuangan-pusbangkom/internal/db"
	"github.com/vandal/keuangan-pusbangkom/internal/services"
)

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

	src, err := file.Open()
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to open file"})
	}
	defer src.Close()

	rows, err := services.ParseAnggaranCSV(src)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": fmt.Sprintf("CSV parse error: %s", err)})
	}

	reqCtx := ctx.Request().Context()
	programCount, akunCount := 0, 0

	programIDs := make(map[string]pgtype.UUID)
	kegiatanIDs := make(map[string]pgtype.UUID)
	outputIDs := make(map[string]pgtype.UUID)
	subOutputIDs := make(map[string]pgtype.UUID)

	for _, row := range rows {
		if _, exists := programIDs[row.ProgramKode]; !exists {
			uid := newPgUUID()
			p, err := h.queries.InsertAnggaranProgram(reqCtx, db.InsertAnggaranProgramParams{
				ID: uid, Kode: row.ProgramKode, Uraian: row.ProgramUraian, TahunAnggaran: int32(tahun),
			})
			if err != nil {
				slog.Error("InsertAnggaranProgram failed", "error", err, "kode", row.ProgramKode)
				continue
			}
			programIDs[row.ProgramKode] = p.ID
			programCount++
		}

		if _, exists := kegiatanIDs[row.KegiatanKode]; !exists {
			uid := newPgUUID()
			k, err := h.queries.InsertAnggaranKegiatan(reqCtx, db.InsertAnggaranKegiatanParams{
				ID: uid, ProgramID: programIDs[row.ProgramKode], Kode: row.KegiatanKode, Uraian: row.KegiatanUraian,
			})
			if err != nil {
				slog.Error("InsertAnggaranKegiatan failed", "error", err, "kode", row.KegiatanKode)
				continue
			}
			kegiatanIDs[row.KegiatanKode] = k.ID
		}

		if _, exists := outputIDs[row.OutputKode]; !exists {
			uid := newPgUUID()
			o, err := h.queries.InsertAnggaranOutput(reqCtx, db.InsertAnggaranOutputParams{
				ID: uid, KegiatanID: kegiatanIDs[row.KegiatanKode], Kode: row.OutputKode, Uraian: row.OutputUraian,
			})
			if err != nil {
				slog.Error("InsertAnggaranOutput failed", "error", err, "kode", row.OutputKode)
				continue
			}
			outputIDs[row.OutputKode] = o.ID
		}

		if _, exists := subOutputIDs[row.SubOutputKode]; !exists {
			uid := newPgUUID()
			so, err := h.queries.InsertAnggaranSubOutput(reqCtx, db.InsertAnggaranSubOutputParams{
				ID: uid, OutputID: outputIDs[row.OutputKode], Kode: row.SubOutputKode, Uraian: row.SubOutputUraian,
			})
			if err != nil {
				slog.Error("InsertAnggaranSubOutput failed", "error", err, "kode", row.SubOutputKode)
				continue
			}
			subOutputIDs[row.SubOutputKode] = so.ID
		}

		uid := newPgUUID()
		_, err = h.queries.InsertAnggaranAkun(reqCtx, db.InsertAnggaranAkunParams{
			ID:          uid,
			SubOutputID: subOutputIDs[row.SubOutputKode],
			Kode:        row.AkunKode,
			Uraian:      row.AkunUraian,
			Pagu:        float64ToNumeric(row.Pagu),
			Realisasi:   float64ToNumeric(row.Realisasi),
			Sisa:        float64ToNumeric(row.Sisa),
		})
		if err != nil {
			slog.Error("InsertAnggaranAkun failed", "error", err, "kode", row.AkunKode)
			continue
		}
		akunCount++
	}

	return ctx.JSON(http.StatusOK, AnggaranImportResult{
		ProgramsUpserted: &programCount,
		AkunUpserted:     &akunCount,
	})
}

func (h *Handler) CreateManualAnggaran(ctx echo.Context) error {
	var body ManualAnggaranRequest
	if err := ctx.Bind(&body); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid request body"})
	}

	reqCtx := ctx.Request().Context()

	uidProg := newPgUUID()
	p, err := h.queries.InsertAnggaranProgram(reqCtx, db.InsertAnggaranProgramParams{
		ID: uidProg, Kode: body.ProgramKode, Uraian: body.ProgramUraian, TahunAnggaran: int32(body.TahunAnggaran),
	})
	if err != nil {
		slog.Error("InsertAnggaranProgram manual failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to insert program"})
	}

	uidKeg := newPgUUID()
	k, err := h.queries.InsertAnggaranKegiatan(reqCtx, db.InsertAnggaranKegiatanParams{
		ID: uidKeg, ProgramID: p.ID, Kode: body.KegiatanKode, Uraian: body.KegiatanUraian,
	})
	if err != nil {
		slog.Error("InsertAnggaranKegiatan manual failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to insert kegiatan"})
	}

	uidOut := newPgUUID()
	o, err := h.queries.InsertAnggaranOutput(reqCtx, db.InsertAnggaranOutputParams{
		ID: uidOut, KegiatanID: k.ID, Kode: body.OutputKode, Uraian: body.OutputUraian,
	})
	if err != nil {
		slog.Error("InsertAnggaranOutput manual failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to insert output"})
	}

	uidSub := newPgUUID()
	so, err := h.queries.InsertAnggaranSubOutput(reqCtx, db.InsertAnggaranSubOutputParams{
		ID: uidSub, OutputID: o.ID, Kode: body.SuboutputKode, Uraian: body.SuboutputUraian,
	})
	if err != nil {
		slog.Error("InsertAnggaranSubOutput manual failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to insert suboutput"})
	}

	uidAkun := newPgUUID()
	_, err = h.queries.InsertAnggaranAkun(reqCtx, db.InsertAnggaranAkunParams{
		ID:          uidAkun,
		SubOutputID: so.ID,
		Kode:        body.AkunKode,
		Uraian:      body.AkunUraian,
		Pagu:        float64ToNumeric(float64(body.Pagu)),
		Realisasi:   float64ToNumeric(float64(body.Realisasi)),
		Sisa:        float64ToNumeric(float64(body.Sisa)),
	})
	if err != nil {
		slog.Error("InsertAnggaranAkun manual failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to insert akun"})
	}

	return ctx.JSON(http.StatusCreated, map[string]string{"message": "Akun Anggaran berhasil ditambahkan"})
}

func (h *Handler) GetAnggaranTree(ctx echo.Context, params GetAnggaranTreeParams) error {
	rows, err := h.queries.GetAnggaranTree(ctx.Request().Context(), int32(params.Tahun))
	if err != nil {
		slog.Error("GetAnggaranTree failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to retrieve Anggaran tree"})
	}
	return ctx.JSON(http.StatusOK, rows)
}
