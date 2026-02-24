package services

import (
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"
)

// AnggaranRow represents a parsed row from a Anggaran report CSV/Excel.
type AnggaranRow struct {
	ProgramKode     string
	ProgramUraian   string
	KegiatanKode    string
	KegiatanUraian  string
	OutputKode      string
	OutputUraian    string
	SubOutputKode   string
	SubOutputUraian string
	AkunKode        string
	AkunUraian      string
	Pagu            float64
	Realisasi       float64
	Sisa            float64
}

// ParseAnggaranCSV reads a Anggaran report CSV and returns structured rows.
// Expected columns: ProgramKode, ProgramUraian, KegiatanKode, KegiatanUraian,
//
//	OutputKode, OutputUraian, SubOutputKode, SubOutputUraian,
//	AkunKode, AkunUraian, Pagu, Realisasi, Sisa
func ParseAnggaranCSV(r io.Reader) ([]AnggaranRow, error) {
	reader := csv.NewReader(r)
	reader.TrimLeadingSpace = true
	reader.LazyQuotes = true

	// Read header
	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV header: %w", err)
	}

	// Build column index map
	colIndex := make(map[string]int)
	for i, col := range header {
		colIndex[strings.TrimSpace(strings.ToLower(col))] = i
	}

	// Validate required columns exist
	requiredCols := []string{"programkode", "programuraian", "kegiatankode", "kegiatanuraian",
		"outputkode", "outputuraian", "suboutputkode", "suboutputuraian",
		"akunkode", "akunuraian", "pagu", "realisasi", "sisa"}
	for _, col := range requiredCols {
		if _, ok := colIndex[col]; !ok {
			return nil, fmt.Errorf("missing required column: %s", col)
		}
	}

	var rows []AnggaranRow
	lineNum := 1
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("error reading CSV line %d: %w", lineNum+1, err)
		}
		lineNum++

		pagu, _ := strconv.ParseFloat(strings.ReplaceAll(record[colIndex["pagu"]], ",", ""), 64)
		realisasi, _ := strconv.ParseFloat(strings.ReplaceAll(record[colIndex["realisasi"]], ",", ""), 64)
		sisa, _ := strconv.ParseFloat(strings.ReplaceAll(record[colIndex["sisa"]], ",", ""), 64)

		rows = append(rows, AnggaranRow{
			ProgramKode:     strings.TrimSpace(record[colIndex["programkode"]]),
			ProgramUraian:   strings.TrimSpace(record[colIndex["programuraian"]]),
			KegiatanKode:    strings.TrimSpace(record[colIndex["kegiatankode"]]),
			KegiatanUraian:  strings.TrimSpace(record[colIndex["kegiatanuraian"]]),
			OutputKode:      strings.TrimSpace(record[colIndex["outputkode"]]),
			OutputUraian:    strings.TrimSpace(record[colIndex["outputuraian"]]),
			SubOutputKode:   strings.TrimSpace(record[colIndex["suboutputkode"]]),
			SubOutputUraian: strings.TrimSpace(record[colIndex["suboutputuraian"]]),
			AkunKode:        strings.TrimSpace(record[colIndex["akunkode"]]),
			AkunUraian:      strings.TrimSpace(record[colIndex["akunuraian"]]),
			Pagu:            pagu,
			Realisasi:       realisasi,
			Sisa:            sisa,
		})
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("CSV file contains no data rows")
	}

	return rows, nil
}
