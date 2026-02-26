package services

import (
	"encoding/csv"
	"fmt"
	"io"
	"math"
	"regexp"
	"strconv"
	"strings"
)

var nonNumericChars = regexp.MustCompile(`[^0-9,.-]`)

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

func ParseAnggaranCSV(r io.Reader) ([]AnggaranRow, error) {
	reader := csv.NewReader(r)
	reader.TrimLeadingSpace = true
	reader.LazyQuotes = true

	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV header: %w", err)
	}

	colIndex := make(map[string]int)
	for i, col := range header {
		colIndex[normalizeHeader(col)] = i
	}

	requiredCols := []string{"programkode", "programuraian", "kegiatankode", "kegiatanuraian",
		"outputkode", "outputuraian", "suboutputkode", "suboutputuraian",
		"akunkode", "akunuraian", "pagu", "realisasi", "sisa"}
	for _, col := range requiredCols {
		if _, ok := colIndex[col]; !ok {
			return nil, fmt.Errorf("missing required column: %s", col)
		}
	}

	var rows []AnggaranRow
	var lastNonEmpty AnggaranRow
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

		programKode := normalizeValue(getCell(record, colIndex, "programkode"))
		programUraian := normalizeValue(getCell(record, colIndex, "programuraian"))
		kegiatanKode := normalizeValue(getCell(record, colIndex, "kegiatankode"))
		kegiatanUraian := normalizeValue(getCell(record, colIndex, "kegiatanuraian"))
		outputKode := normalizeValue(getCell(record, colIndex, "outputkode"))
		outputUraian := normalizeValue(getCell(record, colIndex, "outputuraian"))
		subOutputKode := normalizeValue(getCell(record, colIndex, "suboutputkode"))
		subOutputUraian := normalizeValue(getCell(record, colIndex, "suboutputuraian"))
		akunKode := normalizeValue(getCell(record, colIndex, "akunkode"))
		akunUraian := normalizeValue(getCell(record, colIndex, "akunuraian"))

		if programKode == "" {
			programKode = lastNonEmpty.ProgramKode
		}
		if programUraian == "" {
			programUraian = lastNonEmpty.ProgramUraian
		}
		if kegiatanKode == "" {
			kegiatanKode = lastNonEmpty.KegiatanKode
		}
		if kegiatanUraian == "" {
			kegiatanUraian = lastNonEmpty.KegiatanUraian
		}
		if outputKode == "" {
			outputKode = lastNonEmpty.OutputKode
		}
		if outputUraian == "" {
			outputUraian = lastNonEmpty.OutputUraian
		}
		if subOutputKode == "" {
			subOutputKode = lastNonEmpty.SubOutputKode
		}
		if subOutputUraian == "" {
			subOutputUraian = lastNonEmpty.SubOutputUraian
		}

		pagu := parseFlexibleNumber(getCell(record, colIndex, "pagu"))
		realisasi := parseFlexibleNumber(getCell(record, colIndex, "realisasi"))
		sisa := parseFlexibleNumber(getCell(record, colIndex, "sisa"))

		if programKode == "" || kegiatanKode == "" || outputKode == "" || subOutputKode == "" || akunKode == "" {
			return nil, fmt.Errorf("invalid hierarchy/code at CSV line %d", lineNum)
		}

		rows = append(rows, AnggaranRow{
			ProgramKode:     programKode,
			ProgramUraian:   programUraian,
			KegiatanKode:    kegiatanKode,
			KegiatanUraian:  kegiatanUraian,
			OutputKode:      outputKode,
			OutputUraian:    outputUraian,
			SubOutputKode:   subOutputKode,
			SubOutputUraian: subOutputUraian,
			AkunKode:        akunKode,
			AkunUraian:      akunUraian,
			Pagu:            pagu,
			Realisasi:       realisasi,
			Sisa:            sisa,
		})

		lastNonEmpty = AnggaranRow{
			ProgramKode:     programKode,
			ProgramUraian:   programUraian,
			KegiatanKode:    kegiatanKode,
			KegiatanUraian:  kegiatanUraian,
			OutputKode:      outputKode,
			OutputUraian:    outputUraian,
			SubOutputKode:   subOutputKode,
			SubOutputUraian: subOutputUraian,
		}
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("CSV file contains no data rows")
	}

	return rows, nil
}

func normalizeHeader(input string) string {
	cleaned := strings.ToLower(strings.TrimSpace(input))
	cleaned = strings.ReplaceAll(cleaned, " ", "")
	cleaned = strings.ReplaceAll(cleaned, "_", "")
	cleaned = strings.ReplaceAll(cleaned, "-", "")
	return cleaned
}

func normalizeValue(input string) string {
	trimmed := strings.TrimSpace(input)
	if trimmed == "-" {
		return ""
	}
	return trimmed
}

func getCell(record []string, colIndex map[string]int, key string) string {
	idx, ok := colIndex[key]
	if !ok || idx < 0 || idx >= len(record) {
		return ""
	}
	return record[idx]
}

func parseFlexibleNumber(raw string) float64 {
	value := strings.TrimSpace(raw)
	if value == "" || value == "-" {
		return 0
	}

	value = strings.ReplaceAll(value, "Rp", "")
	value = strings.ReplaceAll(value, "rp", "")
	value = strings.ReplaceAll(value, " ", "")
	value = nonNumericChars.ReplaceAllString(value, "")

	if strings.Count(value, ".") > 1 && !strings.Contains(value, ",") {
		value = strings.ReplaceAll(value, ".", "")
	} else if strings.Count(value, ",") > 1 && !strings.Contains(value, ".") {
		value = strings.ReplaceAll(value, ",", "")
	} else if strings.Contains(value, ".") && strings.Contains(value, ",") {
		value = strings.ReplaceAll(value, ".", "")
		value = strings.ReplaceAll(value, ",", ".")
	} else if strings.Contains(value, ",") && !strings.Contains(value, ".") {
		value = strings.ReplaceAll(value, ",", ".")
	}

	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0
	}
	if math.IsNaN(parsed) || math.IsInf(parsed, 0) {
		return 0
	}
	return parsed
}
