package services

import (
	"encoding/csv"
	"fmt"
	"io"
	"math/big"
	"regexp"
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
	Pagu            string
	Realisasi       string
	Sisa            string
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

		pagu, err := parseFlexibleDecimal(getCell(record, colIndex, "pagu"))
		if err != nil {
			return nil, fmt.Errorf("invalid pagu at CSV line %d: %w", lineNum, err)
		}
		realisasi, err := parseFlexibleDecimal(getCell(record, colIndex, "realisasi"))
		if err != nil {
			return nil, fmt.Errorf("invalid realisasi at CSV line %d: %w", lineNum, err)
		}
		sisa, err := parseFlexibleDecimal(getCell(record, colIndex, "sisa"))
		if err != nil {
			return nil, fmt.Errorf("invalid sisa at CSV line %d: %w", lineNum, err)
		}

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

func ParseAnggaranCSVStream(r io.Reader, handle func(AnggaranRow) error) (int, error) {
	reader := csv.NewReader(r)
	reader.TrimLeadingSpace = true
	reader.LazyQuotes = true

	header, err := reader.Read()
	if err != nil {
		return 0, fmt.Errorf("failed to read CSV header: %w", err)
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
			return 0, fmt.Errorf("missing required column: %s", col)
		}
	}

	count := 0
	var lastNonEmpty AnggaranRow
	lineNum := 1
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return count, fmt.Errorf("error reading CSV line %d: %w", lineNum+1, err)
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

		pagu, err := parseFlexibleDecimal(getCell(record, colIndex, "pagu"))
		if err != nil {
			return count, fmt.Errorf("invalid pagu at CSV line %d: %w", lineNum, err)
		}
		realisasi, err := parseFlexibleDecimal(getCell(record, colIndex, "realisasi"))
		if err != nil {
			return count, fmt.Errorf("invalid realisasi at CSV line %d: %w", lineNum, err)
		}
		sisa, err := parseFlexibleDecimal(getCell(record, colIndex, "sisa"))
		if err != nil {
			return count, fmt.Errorf("invalid sisa at CSV line %d: %w", lineNum, err)
		}

		if programKode == "" || kegiatanKode == "" || outputKode == "" || subOutputKode == "" || akunKode == "" {
			return count, fmt.Errorf("invalid hierarchy/code at CSV line %d", lineNum)
		}

		row := AnggaranRow{
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
		}

		if err := handle(row); err != nil {
			return count, fmt.Errorf("error handling CSV line %d: %w", lineNum, err)
		}
		count++

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

	if count == 0 {
		return 0, fmt.Errorf("CSV file contains no data rows")
	}

	return count, nil
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

func parseFlexibleDecimal(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" || value == "-" {
		return "0", nil
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

	if value == "" || value == "." || value == "-" || value == "-." {
		return "0", nil
	}
	if strings.HasPrefix(value, ".") {
		value = "0" + value
	}
	if strings.HasPrefix(value, "-.") {
		value = "-0" + value[1:]
	}

	var rat big.Rat
	if _, ok := rat.SetString(value); !ok {
		return "", fmt.Errorf("invalid decimal: %q", raw)
	}

	return value, nil
}
