package handlers

import (
	"fmt"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strconv"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/services"
	"github.com/jackc/pgx/v5"
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
	qtx := h.queries.WithTx(tx)

	if _, err := tx.Exec(reqCtx, `
		DROP TABLE IF EXISTS anggaran_akun_import;
		CREATE TEMP TABLE anggaran_akun_import (
			id uuid NOT NULL,
			sub_output_id uuid NOT NULL,
			kode text NOT NULL,
			uraian text NOT NULL,
			pagu numeric NOT NULL,
			realisasi numeric NOT NULL,
			sisa numeric NOT NULL
		) ON COMMIT DROP;
	`); err != nil {
		slog.Error("create temp import table failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to import data"})
	}

	programCount, akunCount := 0, 0

	programIDs := make(map[string]pgtype.UUID)
	kegiatanIDs := make(map[string]pgtype.UUID)
	outputIDs := make(map[string]pgtype.UUID)
	subOutputIDs := make(map[string]pgtype.UUID)

	const akunCopyBatchSize = 2000
	copyRows := make([][]any, 0, akunCopyBatchSize)
	flushAkunCopy := func() error {
		if len(copyRows) == 0 {
			return nil
		}
		_, err := tx.CopyFrom(
			reqCtx,
			pgx.Identifier{"anggaran_akun_import"},
			[]string{"id", "sub_output_id", "kode", "uraian", "pagu", "realisasi", "sisa"},
			pgx.CopyFromRows(copyRows),
		)
		if err != nil {
			return err
		}
		copyRows = copyRows[:0]
		return nil
	}

	_, err = services.ParseAnggaranCSVStream(src, func(row services.AnggaranRow) error {
		if _, exists := programIDs[row.ProgramKode]; !exists {
			uid := newPgUUID()
			p, err := qtx.InsertAnggaranProgram(reqCtx, db.InsertAnggaranProgramParams{
				ID: uid, Kode: row.ProgramKode, Uraian: row.ProgramUraian, TahunAnggaran: int32(tahun),
			})
			if err != nil {
				slog.Error("InsertAnggaranProgram failed", "error", err, "kode", row.ProgramKode)
				return err
			}
			programIDs[row.ProgramKode] = p.ID
			programCount++
		}

		if _, exists := kegiatanIDs[row.KegiatanKode]; !exists {
			uid := newPgUUID()
			k, err := qtx.InsertAnggaranKegiatan(reqCtx, db.InsertAnggaranKegiatanParams{
				ID: uid, ProgramID: programIDs[row.ProgramKode], Kode: row.KegiatanKode, Uraian: row.KegiatanUraian,
			})
			if err != nil {
				slog.Error("InsertAnggaranKegiatan failed", "error", err, "kode", row.KegiatanKode)
				return err
			}
			kegiatanIDs[row.KegiatanKode] = k.ID
		}

		if _, exists := outputIDs[row.OutputKode]; !exists {
			uid := newPgUUID()
			o, err := qtx.InsertAnggaranOutput(reqCtx, db.InsertAnggaranOutputParams{
				ID: uid, KegiatanID: kegiatanIDs[row.KegiatanKode], Kode: row.OutputKode, Uraian: row.OutputUraian,
			})
			if err != nil {
				slog.Error("InsertAnggaranOutput failed", "error", err, "kode", row.OutputKode)
				return err
			}
			outputIDs[row.OutputKode] = o.ID
		}

		if _, exists := subOutputIDs[row.SubOutputKode]; !exists {
			uid := newPgUUID()
			so, err := qtx.InsertAnggaranSubOutput(reqCtx, db.InsertAnggaranSubOutputParams{
				ID: uid, OutputID: outputIDs[row.OutputKode], Kode: row.SubOutputKode, Uraian: row.SubOutputUraian,
			})
			if err != nil {
				slog.Error("InsertAnggaranSubOutput failed", "error", err, "kode", row.SubOutputKode)
				return err
			}
			subOutputIDs[row.SubOutputKode] = so.ID
		}

		copyRows = append(copyRows, []any{
			newPgUUID(),
			subOutputIDs[row.SubOutputKode],
			row.AkunKode,
			row.AkunUraian,
			mustDecimalNumeric(row.Pagu),
			mustDecimalNumeric(row.Realisasi),
			mustDecimalNumeric(row.Sisa),
		})
		if len(copyRows) >= akunCopyBatchSize {
			if err := flushAkunCopy(); err != nil {
				slog.Error("bulk copy akun failed", "error", err)
				return err
			}
		}
		akunCount++
		return nil
	})
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": fmt.Sprintf("CSV parse error: %s", err)})
	}

	if err := flushAkunCopy(); err != nil {
		slog.Error("bulk copy akun flush failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to import data"})
	}

	if _, err := tx.Exec(reqCtx, `
		INSERT INTO anggaran_akun (id, sub_output_id, kode, uraian, pagu, realisasi, sisa)
		SELECT DISTINCT ON (kode)
			id, sub_output_id, kode, uraian, pagu, realisasi, sisa
		FROM anggaran_akun_import
		ORDER BY kode, id
		ON CONFLICT (kode) DO UPDATE SET
			uraian = EXCLUDED.uraian,
			sub_output_id = EXCLUDED.sub_output_id,
			pagu = EXCLUDED.pagu,
			realisasi = EXCLUDED.realisasi,
			sisa = EXCLUDED.sisa;
	`); err != nil {
		slog.Error("merge akun import failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to import data"})
	}

	if err := tx.Commit(reqCtx); err != nil {
		slog.Error("Commit tx failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to import data"})
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
		Pagu:        mustDecimalNumeric(body.Pagu),
		Realisasi:   mustDecimalNumeric(body.Realisasi),
		Sisa:        mustDecimalNumeric(body.Sisa),
	})
	if err != nil {
		slog.Error("InsertAnggaranAkun manual failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to insert akun"})
	}

	return ctx.JSON(http.StatusCreated, map[string]string{"message": "Akun Anggaran berhasil ditambahkan"})
}

func mustDecimalNumeric(s string) pgtype.Numeric {
	n, err := decimalStringToNumeric(s)
	if err != nil {
		return float64ToNumeric(0)
	}
	return n
}

func (h *Handler) GetAnggaranTree(ctx echo.Context, params GetAnggaranTreeParams) error {
	rows, err := h.queries.GetAnggaranTree(ctx.Request().Context(), int32(params.Tahun))
	if err != nil {
		slog.Error("GetAnggaranTree failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to retrieve Anggaran tree"})
	}
	return ctx.JSON(http.StatusOK, rows)
}
