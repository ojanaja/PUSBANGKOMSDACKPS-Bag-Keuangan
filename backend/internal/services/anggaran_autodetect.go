package services

import (
	"bytes"
	"encoding/csv"
	"io"
	"strings"

	"github.com/xuri/excelize/v2"
)

type AnggaranFormat string

const (
	FormatFADetail AnggaranFormat = "fa_detail"
	FormatEMON     AnggaranFormat = "emon"
	FormatUnknown  AnggaranFormat = "unknown"
)

// DetectAndParseExcel opens an xlsx file from reader, auto-detects the format,
// and returns the parsed nodes plus the detected format.
func DetectAndParseExcel(reader io.Reader) ([]AnggaranNodeImport, AnggaranFormat, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, FormatUnknown, err
	}

	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, FormatUnknown, err
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, FormatUnknown, io.EOF
	}
	sheetName := sheets[0]

	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, FormatUnknown, err
	}

	format := detectFormat(rows)

	switch format {
	case FormatEMON:
		nodes := ParseAnggaranEMON(rows)
		return nodes, FormatEMON, nil
	case FormatFADetail:
		csvBuf := rowsToCSV(rows)
		nodes, err := ParseAnggaranCSVBatch(csvBuf)
		if err != nil {
			return nil, FormatFADetail, err
		}
		return nodes, FormatFADetail, nil
	default:
		// Try FA Detail as fallback
		csvBuf := rowsToCSV(rows)
		nodes, err := ParseAnggaranCSVBatch(csvBuf)
		if err != nil {
			return nil, FormatUnknown, err
		}
		if len(nodes) > 0 {
			return nodes, FormatFADetail, nil
		}
		return nil, FormatUnknown, nil
	}
}

func detectFormat(rows [][]string) AnggaranFormat {
	for i, row := range rows {
		if i >= 5 {
			break
		}
		joined := strings.ToUpper(strings.Join(row, " "))

		if strings.Contains(joined, "LAPORAN REALISASI") ||
			strings.Contains(joined, "PER PROGRAM") ||
			strings.Contains(joined, "16 SEGMEN") {
			return FormatFADetail
		}

		if len(row) >= 3 {
			r0 := strings.TrimSpace(strings.ToUpper(safeGet(row, 0)))
			r1 := strings.TrimSpace(strings.ToUpper(safeGet(row, 1)))
			r2 := strings.TrimSpace(strings.ToUpper(safeGet(row, 2)))

			if r0 == "NO" && r1 == "KODE" && (strings.Contains(r2, "KEGIATAN") || strings.Contains(r2, "KRO")) {
				return FormatEMON
			}
		}
	}
	return FormatUnknown
}

func rowsToCSV(rows [][]string) io.Reader {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	writer.Comma = ';'
	for _, row := range rows {
		_ = writer.Write(row)
	}
	writer.Flush()
	return &buf
}

// safeGet is a helper used across packages - it's also defined in anggaran_parser.go
// but we keep a local reference here to avoid circular issues.
func safeGetSlice(row []string, idx int) string {
	if idx >= 0 && idx < len(row) {
		return row[idx]
	}
	return ""
}
