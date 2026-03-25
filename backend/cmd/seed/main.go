package main

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"log/slog"
	"math/big"
	"os"
	"strings"
	"time"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/services"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
)

func main() {
	dbUrl := os.Getenv("DB_URL")
	if dbUrl == "" {
		slog.Error("DB_URL environment variable is required")
		os.Exit(1)
	}

	connectCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	poolCfg, err := pgxpool.ParseConfig(dbUrl)
	if err != nil {
		slog.Error("Unable to parse DB_URL", "error", err)
		os.Exit(1)
	}

	pool, err := pgxpool.NewWithConfig(connectCtx, poolCfg)
	if err != nil {
		slog.Error("Unable to create connection pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(connectCtx); err != nil {
		slog.Error("Unable to ping database", "error", err)
		os.Exit(1)
	}
	slog.Info("Successfully connected to database")

	filePath := "/Users/fauzan/Downloads/Laporan Fa Detail (16 Segmen) (4).xlsx"
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		slog.Error("Failed to open excel file", "error", err, "path", filePath)
		os.Exit(1)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		slog.Error("No sheets found in excel file")
		os.Exit(1)
	}
	sheetName := sheets[0]
	rows, err := f.GetRows(sheetName)
	if err != nil {
		slog.Error("Failed to get rows", "error", err)
		os.Exit(1)
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	writer.Comma = ';'
	for _, row := range rows {
		if err := writer.Write(row); err != nil {
			slog.Error("Failed to write csv row", "error", err)
			os.Exit(1)
		}
	}
	writer.Flush()
    if err := writer.Error(); err != nil {
        slog.Error("Error flushing csv", "error", err)
        os.Exit(1)
    }

	txCtx := context.Background()
	tx, err := pool.Begin(txCtx)
	if err != nil {
		slog.Error("Begin tx failed", "error", err)
		os.Exit(1)
	}
	defer tx.Rollback(txCtx)

	slog.Info("Truncating existing data...")
	if _, err := tx.Exec(txCtx, `TRUNCATE TABLE anggaran_node CASCADE;`); err != nil {
		slog.Error("Truncate failed", "error", err)
		os.Exit(1)
	}

	nodeCount := 0
	var parentIDs [10]pgtype.UUID
	tahun := 2026

	_, err = services.ParseAnggaranCSVStream(&buf, func(node services.AnggaranNodeImport) error {
		parentID := pgtype.UUID{Valid: false}
		if node.ParentLevel >= 0 {
			parentID = parentIDs[node.ParentLevel]
		}

		var insertedID pgtype.UUID
		err := tx.QueryRow(txCtx, `
            INSERT INTO anggaran_node (
                id, parent_id, jenis, kode, uraian, tahun_anggaran, 
                pagu_revisi, lock_pagu, realisasi_periode_lalu, realisasi_periode_ini, 
                realisasi_sd_periode, persentase_realisasi, sisa_anggaran
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
            )
            RETURNING id;
        `,
			parentID, node.Jenis, node.Kode, node.Uraian, tahun,
			mustDecimalNumeric(node.PaguRevisi), mustDecimalNumeric(node.LockPagu),
			mustDecimalNumeric(node.RealisasiLalu), mustDecimalNumeric(node.RealisasiIni),
			mustDecimalNumeric(node.RealisasiSD), mustDecimalNumeric(node.Persentase),
			mustDecimalNumeric(node.Sisa),
		).Scan(&insertedID)

		if err != nil {
			slog.Error("insert node failed", "error", err, "kode", node.Kode)
			return err
		}

		parentIDs[node.Level] = insertedID
		nodeCount++
		return nil
	})

	if err != nil {
		slog.Error("Parse error", "error", err)
		os.Exit(1)
	}

	if err := tx.Commit(txCtx); err != nil {
		slog.Error("Commit tx failed", "error", err)
		os.Exit(1)
	}

	slog.Info("Successfully seeded data", "nodes_inserted", nodeCount)
}

func mustDecimalNumeric(s string) pgtype.Numeric {
	n, err := decimalStringToNumeric(s)
	if err != nil {
		return float64ToNumeric(0)
	}
	return n
}

func decimalStringToNumeric(s string) (pgtype.Numeric, error) {
	var num pgtype.Numeric
	var val big.Int
    
    // basic sanitization matching handlers logic
    s = strings.ReplaceAll(s, ",", ".")
    parts := strings.Split(s, ".")
    var rawStr string
    var decLen int
    if len(parts) == 1 {
        rawStr = parts[0]
        decLen = 0
    } else if len(parts) == 2 {
        rawStr = parts[0] + parts[1]
        decLen = len(parts[1])
    } else {
        return num, fmt.Errorf("invalid decimal format")
    }

	if _, ok := val.SetString(rawStr, 10); !ok {
		return num, fmt.Errorf("invalid numeric string: %s", s)
	}
    
    num.Int = &val
    num.Exp = int32(-decLen)
    num.Valid = true
	return num, nil
}

func float64ToNumeric(f float64) pgtype.Numeric {
	var num pgtype.Numeric
	num.Valid = true
	num.Int = big.NewInt(int64(f)) 
    // Simplified for fallback of 0
	return num
}
