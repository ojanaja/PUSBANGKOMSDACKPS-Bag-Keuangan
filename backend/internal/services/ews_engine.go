package services

import (
	"context"
	"log/slog"
	"time"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/util"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type EWSAlert struct {
	PaketID        pgtype.UUID `json:"paket_id"`
	NamaPaket      string      `json:"nama_paket"`
	Bulan          int32       `json:"bulan"`
	Severity       string      `json:"severity"`
	Rule           string      `json:"rule"`
	Message        string      `json:"message"`
	PersenKeuangan float64     `json:"persen_keuangan"`
	PersenFisik    float64     `json:"persen_fisik"`
	Deviasi        float64     `json:"deviasi"`
	CreatedAt      time.Time   `json:"created_at"`
}

type EWSEngine struct {
	queries *db.Queries
}

func NewEWSEngine(q *db.Queries) *EWSEngine {
	return &EWSEngine{queries: q}
}

func (e *EWSEngine) RunAllChecks(ctx context.Context) []EWSAlert {
	var alerts []EWSAlert

	pakets, err := e.queries.ListPaketPekerjaan(ctx)
	if err != nil {
		slog.Error("EWS: failed to list pakets", "error", err)
		return alerts
	}
	if len(pakets) == 0 {
		return alerts
	}

	paketIDs := make([]pgtype.UUID, 0, len(pakets))
	for _, p := range pakets {
		if !p.ID.Valid {
			continue
		}
		paketIDs = append(paketIDs, p.ID)
	}
	if len(paketIDs) == 0 {
		return alerts
	}

	targetRows, err := e.queries.GetPaketTargetsByPaketIDs(ctx, paketIDs)
	if err != nil {
		slog.Error("EWS: failed to load paket targets", "error", err)
		return alerts
	}
	realisasiRows, err := e.queries.GetRealisasiFisikByPaketIDs(ctx, paketIDs)
	if err != nil {
		slog.Error("EWS: failed to load realisasi fisik", "error", err)
		return alerts
	}
	docRows, err := e.queries.GetDocumentsByPaketIDs(ctx, paketIDs)
	if err != nil {
		slog.Warn("EWS: failed to load documents", "error", err)
	}

	targetByPaketBulan := make(map[string]map[int32]db.PaketTarget)
	for _, t := range targetRows {
		if !t.PaketID.Valid {
			continue
		}
		key := uuid.UUID(t.PaketID.Bytes).String()
		if targetByPaketBulan[key] == nil {
			targetByPaketBulan[key] = make(map[int32]db.PaketTarget)
		}
		targetByPaketBulan[key][t.Bulan] = t
	}

	realisasiByPaketBulan := make(map[string]map[int32]db.GetRealisasiFisikByPaketIDsRow)
	for _, r := range realisasiRows {
		if !r.PaketID.Valid {
			continue
		}
		key := uuid.UUID(r.PaketID.Bytes).String()
		if realisasiByPaketBulan[key] == nil {
			realisasiByPaketBulan[key] = make(map[int32]db.GetRealisasiFisikByPaketIDsRow)
		}
		realisasiByPaketBulan[key][r.Bulan] = r
	}

	docsPerPaketBulan := make(map[string]map[int32]int)
	for _, d := range docRows {
		if !d.PaketID.Valid {
			continue
		}
		key := uuid.UUID(d.PaketID.Bytes).String()
		if docsPerPaketBulan[key] == nil {
			docsPerPaketBulan[key] = make(map[int32]int)
		}
		docsPerPaketBulan[key][d.Bulan]++
	}

	appendAlert := func(paket db.PaketPekerjaan, bulan int32, severity, rule, message string, persenKeuangan, persenFisik, deviasi float64) {
		alerts = append(alerts, EWSAlert{
			PaketID:        paket.ID,
			NamaPaket:      paket.NamaPaket,
			Bulan:          bulan,
			Severity:       severity,
			Rule:           rule,
			Message:        message,
			PersenKeuangan: persenKeuangan,
			PersenFisik:    persenFisik,
			Deviasi:        deviasi,
			CreatedAt:      time.Now(),
		})
	}

	for _, paket := range pakets {
		if !paket.ID.Valid {
			continue
		}
		key := uuid.UUID(paket.ID.Bytes).String()
		targetMap := targetByPaketBulan[key]
		realisasiMap := realisasiByPaketBulan[key]
		docsPerBulan := docsPerPaketBulan[key]

		currentMonth := int32(time.Now().Month())

		for bulan := int32(1); bulan <= currentMonth; bulan++ {
			target, hasTarget := targetMap[bulan]
			real, hasReal := realisasiMap[bulan]

			if hasTarget && hasReal {
				targetFisik := util.NumericToFloat64(target.PersenFisik)
				actualFisik := util.NumericToFloat64(real.PersenAktual)
				deviasi := targetFisik - actualFisik

				if deviasi > 10 {
					appendAlert(paket, bulan, "WARNING", "DEVIASI_FISIK_GT_10", "Deviasi realisasi fisik > 10% dari target", util.NumericToFloat64(target.PersenKeuangan), actualFisik, deviasi)
				}
			}

			if hasTarget {
				targetKeu := util.NumericToFloat64(target.PersenKeuangan)
				actualFisik := float64(0)
				if hasReal {
					actualFisik = util.NumericToFloat64(real.PersenAktual)
				}
				if targetKeu > 0 && actualFisik == 0 {
					appendAlert(paket, bulan, "CRITICAL", "PENCAIRAN_TANPA_FISIK", "Ada pencairan keuangan tanpa realisasi fisik", targetKeu, actualFisik, 0)
				}
			}

			docsCount := 0
			if docsPerBulan != nil {
				docsCount = docsPerBulan[bulan]
			}
			if docsCount == 0 && (hasTarget || hasReal) {
				appendAlert(paket, bulan, "CRITICAL", "DOKUMEN_BUKTI_KOSONG", "Tidak ada dokumen bukti untuk bulan ini", 0, 0, 0)
			}
		}
	}

	slog.Info("EWS check completed", "total_alerts", len(alerts))
	return alerts
}

func (e *EWSEngine) StartCron(ctx context.Context, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		e.RunAllChecks(ctx)

		for {
			select {
			case <-ticker.C:
				e.RunAllChecks(ctx)
			case <-ctx.Done():
				slog.Info("EWS cron stopped")
				return
			}
		}
	}()
	slog.Info("EWS cron started", "interval", interval.String())
}
