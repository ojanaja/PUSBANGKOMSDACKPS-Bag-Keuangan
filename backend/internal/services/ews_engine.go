package services

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/vandal/keuangan-pusbangkom/internal/db"
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

	for _, paket := range pakets {
		targets, err := e.queries.GetPaketTargetsByPaketID(ctx, paket.ID)
		if err != nil {
			continue
		}
		realisasi, err := e.queries.GetRealisasiFisikByPaketID(ctx, paket.ID)
		if err != nil {
			continue
		}

		targetMap := make(map[int32]db.PaketTarget)
		for _, t := range targets {
			targetMap[t.Bulan] = t
		}
		realisasiMap := make(map[int32]db.GetRealisasiFisikByPaketIDRow)
		for _, r := range realisasi {
			realisasiMap[r.Bulan] = r
		}

		docs, _ := e.queries.GetDocumentsByPaket(ctx, paket.ID)
		docsPerBulan := make(map[int32]int)
		for _, d := range docs {
			docsPerBulan[d.Bulan]++
		}

		currentMonth := int32(time.Now().Month())

		for bulan := int32(1); bulan <= currentMonth; bulan++ {
			target, hasTarget := targetMap[bulan]
			real, hasReal := realisasiMap[bulan]

			if hasTarget && hasReal {
				targetFisik := numericToFloat64(target.PersenFisik)
				actualFisik := numericToFloat64(real.PersenAktual)
				deviasi := targetFisik - actualFisik

				if deviasi > 10 {
					alerts = append(alerts, EWSAlert{
						PaketID:        paket.ID,
						NamaPaket:      paket.NamaPaket,
						Bulan:          bulan,
						Severity:       "WARNING",
						Rule:           "DEVIASI_FISIK_GT_10",
						Message:        "Deviasi realisasi fisik > 10% dari target",
						PersenKeuangan: numericToFloat64(target.PersenKeuangan),
						PersenFisik:    actualFisik,
						Deviasi:        deviasi,
						CreatedAt:      time.Now(),
					})
				}
			}

			if hasTarget {
				targetKeu := numericToFloat64(target.PersenKeuangan)
				actualFisik := float64(0)
				if hasReal {
					actualFisik = numericToFloat64(real.PersenAktual)
				}
				if targetKeu > 0 && actualFisik == 0 {
					alerts = append(alerts, EWSAlert{
						PaketID:        paket.ID,
						NamaPaket:      paket.NamaPaket,
						Bulan:          bulan,
						Severity:       "CRITICAL",
						Rule:           "PENCAIRAN_TANPA_FISIK",
						Message:        "Ada pencairan keuangan tanpa realisasi fisik",
						PersenKeuangan: targetKeu,
						PersenFisik:    actualFisik,
						CreatedAt:      time.Now(),
					})
				}
			}

			if docsPerBulan[bulan] == 0 && (hasTarget || hasReal) {
				alerts = append(alerts, EWSAlert{
					PaketID:   paket.ID,
					NamaPaket: paket.NamaPaket,
					Bulan:     bulan,
					Severity:  "CRITICAL",
					Rule:      "DOKUMEN_BUKTI_KOSONG",
					Message:   "Tidak ada dokumen bukti untuk bulan ini",
					CreatedAt: time.Now(),
				})
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

func numericToFloat64(n pgtype.Numeric) float64 {
	f, _ := n.Float64Value()
	return f.Float64
}
