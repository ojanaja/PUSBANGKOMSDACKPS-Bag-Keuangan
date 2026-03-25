package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	"github.com/xuri/excelize/v2"
)

var closeExcelFile = func(f *excelize.File) error {
	return f.Close()
}

func (h *Handler) GetDashboardChart(ctx echo.Context, params GetDashboardChartParams) error {
	reqCtx := ctx.Request().Context()
	var rows []db.GetDashboardChartRow
	var err error

	if params.Tahun != nil {
		rows, err = h.queries.GetDashboardChart(reqCtx, pgtype.Int4{Int32: int32(*params.Tahun), Valid: true})
	} else {
		rows, err = h.queries.GetDashboardChart(reqCtx, pgtype.Int4{Int32: 0, Valid: false})
	}

	if err != nil {
		slog.Error("GetDashboardChart failed", "error", err, "tahun", params.Tahun)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to retrieve chart data"})
	}

	result := make([]DashboardChartItem, 0, len(rows))
	for _, row := range rows {
		bulan := int(row.Bulan)
		renKes := float32(numericToFloat64(row.RencanaKeuanganPersen))
		realKes := numericToDecimalString(row.RealisasiKeuanganRp)
		renFis := float32(numericToFloat64(row.RencanaFisikPersen))
		realFis := float32(numericToFloat64(row.RealisasiFisikPersen))

		result = append(result, DashboardChartItem{
			Bulan:             &bulan,
			RencanaKeuangan:   &renKes,
			RealisasiKeuangan: &realKes,
			RencanaFisik:      &renFis,
			RealisasiFisik:    &realFis,
		})
	}
	return ctx.JSON(http.StatusOK, result)
}

func (h *Handler) GetDashboardDrilldown(ctx echo.Context, params GetDashboardDrilldownParams) error {
	reqCtx := ctx.Request().Context()
	var rows []db.GetDashboardDrillDownRow
	var err error

	if params.Tahun != nil {
		rows, err = h.queries.GetDashboardDrillDown(reqCtx, db.GetDashboardDrillDownParams{
			Bulan:         int32(params.Bulan),
			TahunAnggaran: pgtype.Int4{Int32: int32(*params.Tahun), Valid: true},
		})
	} else {
		rows, err = h.queries.GetDashboardDrillDown(reqCtx, db.GetDashboardDrillDownParams{
			Bulan:         int32(params.Bulan),
			TahunAnggaran: pgtype.Int4{Int32: 0, Valid: false},
		})
	}
	if err != nil {
		slog.Error("GetDashboardDrilldown failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to retrieve drilldown data"})
	}

	result := make([]DashboardDrilldownItem, 0, len(rows))
	for _, row := range rows {
		pagu := numericToDecimalString(row.PaguPaket)
		realKes := numericToDecimalString(row.RealisasiKeuanganRp)

		realFis := float32(numericToFloat64(row.RealisasiFisikPersen))
		namaPak := row.NamaPaket
		uid := pgUUIDToOpenAPI(row.PaketID)

		var docs []DocumentMeta
		if len(row.Dokumen) > 0 {
			if err := json.Unmarshal(row.Dokumen, &docs); err != nil {
				slog.Error("failed to unmarshal documents", "error", err)
			}
		}

		result = append(result, DashboardDrilldownItem{
			PaketId:           uid,
			NamaPaket:         &namaPak,
			PaguPaket:         &pagu,
			RealisasiKeuangan: &realKes,
			RealisasiFisik:    &realFis,
			Dokumen:           &docs,
		})
	}
	return ctx.JSON(http.StatusOK, result)
}

func (h *Handler) GetDashboardNotifications(ctx echo.Context) error {
	rows, err := h.queries.GetComplianceMatrix(ctx.Request().Context(), pgtype.Int4{Int32: 0, Valid: false})
	if err != nil {
		slog.Error("GetDashboardNotifications logic failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to calculate notifications"})
	}

	results := []NotificationItem{}
	for _, row := range rows {
		paguAnggaran := numericToFloat64(row.PaguAnggaran)
		realKeu := numericToFloat64(row.RealisasiAnggaran)
		realFis := numericToFloat64(row.RealisasiFisik)
		pctKeu := float64(0)
		if paguAnggaran > 0 {
			pctKeu = (realKeu / paguAnggaran) * 100
		}

		idStr := uuidToOpenAPI(row.ID)
		nama := row.NamaPaket

		if pctKeu > 0 && realFis == 0 {
			results = append(results, NotificationItem{
				Id:      ptr(fmt.Sprintf("crit-%s", *idStr)),
				Title:   ptr("Kritis: Realisasi Kosong"),
				Detail:  ptr(fmt.Sprintf("Pencairan dana sudah ada pada paket '%s', namun laporan fisik/dokumentasi masih kosong.", nama)),
				Type:    ptr(NotificationItemType("critical")),
				Time:    ptr("Baru saja"),
				PaketId: idStr,
			})
		}

		if realFis < pctKeu*0.9 && realFis > 0 {
			results = append(results, NotificationItem{
				Id:      ptr(fmt.Sprintf("warn-%s", *idStr)),
				Title:   ptr("Peringatan: Deviasi Tinggi"),
				Detail:  ptr(fmt.Sprintf("Paket '%s' mengalami deviasi fisik negatif. Progres lapangan tertinggal dari pencairan dana.", nama)),
				Type:    ptr(NotificationItemType("warning")),
				Time:    ptr("Baru saja"),
				PaketId: idStr,
			})
		}
	}

	return ctx.JSON(http.StatusOK, results)
}

func (h *Handler) GetDashboardEWS(ctx echo.Context, params GetDashboardEWSParams) error {
	reqCtx := ctx.Request().Context()
	var rows []db.GetComplianceMatrixRow
	var err error

	if params.Tahun != nil {
		rows, err = h.queries.GetComplianceMatrix(reqCtx, pgtype.Int4{Int32: int32(*params.Tahun), Valid: true})
	} else {
		rows, err = h.queries.GetComplianceMatrix(reqCtx, pgtype.Int4{Int32: 0, Valid: false})
	}

	if err != nil {
		slog.Error("GetDashboardEWS failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to retrieve EWS data"})
	}

	results := []DashboardEWSItem{}
	for _, row := range rows {
		paguAnggaran := numericToFloat64(row.PaguAnggaran)
		realKeu := numericToFloat64(row.RealisasiAnggaran)
		realFis := numericToFloat64(row.RealisasiFisik)

		pctKeu := float64(0)
		if paguAnggaran > 0 {
			pctKeu = (realKeu / paguAnggaran) * 100
		}

		status := "LENGKAP"
		alasan := "Progres sesuai dengan penyerapan anggaran."
		if pctKeu > 0 && realFis == 0 {
			status = "TIDAK_LENGKAP"
			alasan = "Dana sudah cair namun belum ada laporan fisik/dokumentasi."
		} else if realFis < pctKeu*0.9 {
			status = "PERINGATAN"
			alasan = "Terjadi deviasi fisik negatif (keterlambatan pekerjaan)."
		}

		idStr := uuidToOpenAPI(row.ID)
		results = append(results, DashboardEWSItem{
			PaketId:                 idStr,
			NamaPaket:               ptr(row.NamaPaket),
			Status:                  ptr(DashboardEWSItemStatus(status)),
			Alasan:                  ptr(alasan),
			DeviasiFisik:            ptr(float32(realFis - pctKeu)),
			RealisasiKeuanganPersen: ptr(float32(pctKeu)),
			RealisasiFisikPersen:    ptr(float32(realFis)),
		})
	}

	return ctx.JSON(http.StatusOK, results)
}

func (h *Handler) ExportPaketExcel(ctx echo.Context, params ExportPaketExcelParams) error {
	reqCtx := ctx.Request().Context()
	tahun := int32(0)
	if params.Tahun != nil {
		tahun = int32(*params.Tahun)
	}

	f := excelize.NewFile()
	defer func() {
		if err := closeExcelFile(f); err != nil {
			fmt.Println(err)
		}
	}()

	sheet := "Rekap Kepatuhan"
	f.SetSheetName("Sheet1", sheet)
	headers := []interface{}{"Nama Paket", "Pagu Paket", "Realisasi Keuangan (Rp)", "Keuangan (%)", "Fisik (%)", "Deviasi (%)", "Status EWS", "Alasan/Keterangan"}
	for idx, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(idx+1, 1)
		f.SetCellValue(sheet, cell, header)
	}

	rowIdx := 2
	limit := int32(1000)
	offset := int32(0)
	for {
		var rows []db.GetComplianceMatrixPagedRow
		var err error

		if params.Tahun != nil {
			rows, err = h.queries.GetComplianceMatrixPaged(reqCtx, db.GetComplianceMatrixPagedParams{
				TahunAnggaran: pgtype.Int4{Int32: tahun, Valid: true},
				Limit:         limit,
				Offset:        offset,
			})
		} else {
			rows, err = h.queries.GetComplianceMatrixPaged(reqCtx, db.GetComplianceMatrixPagedParams{
				TahunAnggaran: pgtype.Int4{Int32: 0, Valid: false},
				Limit:         limit,
				Offset:        offset,
			})
		}
		if err != nil {
			slog.Error("ExportPaketExcel failed to fetch data", "error", err)
			return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to retrieve data for export"})
		}
		if len(rows) == 0 {
			break
		}

		for _, row := range rows {
			paguAnggaran := numericToFloat64(row.PaguAnggaran)
			realKeu := numericToFloat64(row.RealisasiAnggaran)
			realFis := numericToFloat64(row.RealisasiFisik)

			pctKeu := float64(0)
			if paguAnggaran > 0 {
				pctKeu = (realKeu / paguAnggaran) * 100
			}

			status := "LENGKAP"
			alasan := "Progres sesuai"
			if pctKeu > 0 && realFis == 0 {
				status = "TIDAK LENGKAP (KRITIS)"
				alasan = "Dana cair, fisik 0%"
			} else if realFis < pctKeu*0.9 {
				status = "PERINGATAN"
				alasan = "Deviasi negatif"
			}

			data := []interface{}{
				row.NamaPaket,
				paguAnggaran,
				realKeu,
				fmt.Sprintf("%.2f%%", pctKeu),
				fmt.Sprintf("%.2f%%", realFis),
				fmt.Sprintf("%.2f%%", realFis-pctKeu),
				status,
				alasan,
			}
			for col, val := range data {
				cell, _ := excelize.CoordinatesToCellName(col+1, rowIdx)
				f.SetCellValue(sheet, cell, val)
			}
			rowIdx++
		}

		offset += int32(len(rows))
		if int32(len(rows)) < limit {
			break
		}
	}

	f.SetColWidth(sheet, "A", "A", 40)
	f.SetColWidth(sheet, "B", "C", 20)
	f.SetColWidth(sheet, "D", "F", 15)
	f.SetColWidth(sheet, "G", "G", 25)
	f.SetColWidth(sheet, "H", "H", 40)

	ctx.Response().Header().Set(echo.HeaderContentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	ctx.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf("attachment; filename=Rekap_Kepatuhan_%d.xlsx", tahun))
	ctx.Response().WriteHeader(http.StatusOK)

	return f.Write(ctx.Response().Writer)
}
