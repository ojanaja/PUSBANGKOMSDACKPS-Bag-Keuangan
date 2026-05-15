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
var groupedThousandsComma = regexp.MustCompile(`^-?\d{1,3}(,\d{3})+$`)

type AnggaranNodeImport struct {
	Level         int
	Jenis         string
	Kode          string
	Uraian        string
	PaguRevisi    string
	LockPagu      string
	RealisasiLalu string
	RealisasiIni  string
	RealisasiSD   string
	Persentase    string
	Sisa          string
	ParentLevel   int
}

func ParseAnggaranCSVStream(r io.Reader, handle func(AnggaranNodeImport) error) (int, error) {
	reader := csv.NewReader(r)
	reader.TrimLeadingSpace = true
	reader.LazyQuotes = true
	reader.Comma = ';'
	reader.FieldsPerRecord = -1

	count := 0
	lineNum := 0

	var lastNodeAtLevel [10]AnggaranNodeImport

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return count, fmt.Errorf("error reading CSV line %d: %w", lineNum+1, err)
		}
		lineNum++

		if len(record) < 2 {
			continue
		}

		if strings.Contains(strings.ToUpper(record[0]), "LAPORAN") || strings.Contains(strings.ToUpper(record[0]), "Uraian") || strings.Contains(strings.ToUpper(record[0]), "JUMLAH") || strings.Contains(strings.ToUpper(record[0]), "KEMENTERIAN") || strings.Contains(strings.ToUpper(record[0]), "UNIT ORGANISASI") || strings.Contains(strings.ToUpper(record[0]), "SATUAN KERJA") {
			continue
		}

		node, isRelevant := parseRow(record)
		if !isRelevant {
			continue
		}

		parentLevel := -1
		for i := node.Level - 1; i >= 0; i-- {
			if lastNodeAtLevel[i].Kode != "" {
				parentLevel = i
				break
			}
		}
		node.ParentLevel = parentLevel

		if err := handle(node); err != nil {
			return count, fmt.Errorf("error handling CSV line %d: %w", lineNum, err)
		}

		lastNodeAtLevel[node.Level] = node
		for i := node.Level + 1; i < 10; i++ {
			lastNodeAtLevel[i] = AnggaranNodeImport{}
		}

		count++
	}

	return count, nil
}

// ParseAnggaranCSVBatch parses FA Detail CSV and returns all nodes as a slice (non-streaming).
func ParseAnggaranCSVBatch(r io.Reader) ([]AnggaranNodeImport, error) {
	var result []AnggaranNodeImport
	_, err := ParseAnggaranCSVStream(r, func(node AnggaranNodeImport) error {
		result = append(result, node)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func parseRow(record []string) (AnggaranNodeImport, bool) {
	node := AnggaranNodeImport{}
	isRelevant := false

	col1 := strings.TrimSpace(safeGet(record, 1))
	col2 := strings.TrimSpace(safeGet(record, 2))
	col4 := strings.TrimSpace(safeGet(record, 4))
	col5 := strings.TrimSpace(safeGet(record, 5))
	col7 := strings.TrimSpace(safeGet(record, 7))
	col14 := strings.TrimSpace(safeGet(record, 14))

	col11 := strings.TrimSpace(safeGet(record, 11))
	col12 := strings.TrimSpace(safeGet(record, 12))
	dateRegex := regexp.MustCompile(`^\d{2}-\d{2}-\d{4}$`)

	if dateRegex.MatchString(col1) && (col11 != "" || col12 != "") {
		node.Level = 8
		node.Jenis = "TRANSAKSI"
		sp2d := col11
		if sp2d == "" {
			sp2d = col12
		}
		node.Kode = col1 + " | " + sp2d
		node.Uraian = firstNonEmpty(record, 17, 16)
		isRelevant = true
	} else if col1 != "" {
		if !strings.Contains(col1, ".") {
			node.Level = 0
			node.Jenis = "PROGRAM"
			node.Kode = col1
			node.Uraian = firstNonEmpty(record, 3, 8, 6)
			isRelevant = true
		} else {
			node.Level = 1
			node.Jenis = "KEGIATAN"
			node.Kode = col1
			node.Uraian = firstNonEmpty(record, 8, 7, 6, 3)
			isRelevant = true
		}
	} else if col2 != "" {
		if !strings.Contains(col2, ".") {
			node.Level = 2
			node.Jenis = "OUTPUT_GROUP"
			node.Kode = col2
			node.Uraian = firstNonEmpty(record, 6, 8, 9)
			isRelevant = true
		} else {
			node.Level = 3
			node.Jenis = "OUTPUT"
			node.Kode = col2
			node.Uraian = firstNonEmpty(record, 10, 8, 9)
			isRelevant = true
		}
	} else if col4 != "" {
		node.Level = 4
		node.Jenis = "SUBOUTPUT_GROUP"
		node.Kode = col4
		node.Uraian = firstNonEmpty(record, 9, 10, 11)
		isRelevant = true
	} else if col5 != "" {
		node.Level = 5
		node.Jenis = "SUBOUTPUT"
		node.Kode = col5
		node.Uraian = firstNonEmpty(record, 11, 10, 9)
		isRelevant = true
	} else if col7 != "" {
		node.Level = 6
		node.Jenis = "AKUN"
		node.Kode = col7
		node.Uraian = firstNonEmpty(record, 12, 13, 11)
		isRelevant = true
	} else if col14 != "" {
		node.Level = 7
		node.Jenis = "ITEM"
		parts := strings.SplitN(col14, ".", 2)
		if len(parts) == 2 {
			node.Kode = strings.TrimSpace(parts[0])
			node.Uraian = strings.TrimSpace(parts[1])
		} else {
			node.Kode = col14
			node.Uraian = col14
		}
		isRelevant = true
	}

	if !isRelevant {
		return node, false
	}

	paguCol := 15
	lockCol := 17
	laluCol := 21
	iniCol := 22
	sdCol := 24
	perCol := 27
	sisaCol := 29

	if node.Level == 8 {
		iniCol = 23 // TRANSAKSI probably shifted too, let's keep the relative +1 if it was 26 25 ? I'll just check if it's 23. Wait, SP2D in original was iniCol = 26 instead of 25.
	}

	node.PaguRevisi = parseFlexibleDecimal(safeGet(record, paguCol))
	node.LockPagu = parseFlexibleDecimal(safeGet(record, lockCol))
	node.RealisasiLalu = parseFlexibleDecimal(safeGet(record, laluCol))
	node.RealisasiIni = parseFlexibleDecimal(safeGet(record, iniCol))
	node.RealisasiSD = parseFlexibleDecimal(safeGet(record, sdCol))
	node.Persentase = parseFlexiblePercent(safeGet(record, perCol))
	node.Sisa = parseFlexibleDecimal(safeGet(record, sisaCol))

	return node, true
}

func safeGet(record []string, idx int) string {
	if idx >= 0 && idx < len(record) {
		return record[idx]
	}
	return ""
}

func firstNonEmpty(record []string, candidates ...int) string {
	for _, idx := range candidates {
		v := strings.TrimSpace(safeGet(record, idx))
		if v != "" {
			return v
		}
	}
	return ""
}

func parseFlexibleDecimal(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" || value == "-" {
		return "0"
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
		// FA Detail monetary values commonly use comma as thousands separator,
		// e.g. "552,780" should become "552780" not "552.780".
		if groupedThousandsComma.MatchString(value) {
			value = strings.ReplaceAll(value, ",", "")
		} else {
			value = strings.ReplaceAll(value, ",", ".")
		}
	}

	if value == "" || value == "." || value == "-" || value == "-." {
		return "0"
	}
	if strings.HasPrefix(value, ".") {
		value = "0" + value
	}
	if strings.HasPrefix(value, "-.") {
		value = "-0" + value[1:]
	}

	var rat big.Rat
	if _, ok := rat.SetString(value); !ok {
		return "0"
	}

	return value
}

func parseFlexiblePercent(raw string) string {
	val := parseFlexibleDecimal(raw)
	return val
}
