package services

import (
	"strings"
)

// ParseAnggaranRKKS parses the RKKS format Excel data.
// Columns: 0=Kode, 1=Uraian, 2=Volume, 3=Harga Satuan, 4=Jumlah
// Kode format: "694423.145.12.WA.7769.AFA.02.00|| 7769.AFA"
func ParseAnggaranRKKS(rows [][]string) []AnggaranNodeImport {
	var result []AnggaranNodeImport
	var lastNodeAtLevel [20]AnggaranNodeImport

	dataStarted := false

	for _, row := range rows {
		if len(row) < 5 {
			continue
		}

		col0 := strings.TrimSpace(safeGetSlice(row, 0))
		if strings.ToUpper(col0) == "KODE" {
			dataStarted = true
			continue
		}
		if !dataStarted || col0 == "" || strings.HasPrefix(col0, "Jumlah") {
			continue
		}

		// Check if it's an item under Akun
		// e.g. "694423.145.12.WA.7769.AFA.02.00.001.100.A.521211.A.00001||"
		parts := strings.Split(col0, "||")
		fullKode := strings.TrimSpace(parts[0])
		
		shortKode := ""
		if len(parts) > 1 && strings.TrimSpace(parts[1]) != "" {
			shortKode = strings.TrimSpace(parts[1])
		} else {
			// Item node usually has empty right side of || 
			pathParts := strings.Split(fullKode, ".")
			shortKode = pathParts[len(pathParts)-1]
		}

		uraian := strings.TrimSpace(safeGetSlice(row, 1))

		// If uraian starts with "- ", it's a detail item. So we can label it ITEM.
		level := strings.Count(fullKode, ".")
		jenis := "NODE"
		if level == 0 {
			jenis = "SATKER"
		} else if level == 1 {
			jenis = "PROGRAM"
		} else if level == 2 {
			jenis = "KEGIATAN"
		} else if level == 4 {
			jenis = "KRO"
		} else if level == 5 {
			jenis = "RO"
		} else if level == 6 {
			jenis = "KOMPONEN"
		} else if level == 7 {
			jenis = "SUBKOMPONEN"
		} else if level == 8 {
			jenis = "AKUN"
		} else if level >= 9 {
			jenis = "ITEM"
		}

		// Limit level array bounds
		effectiveLevel := level
		if effectiveLevel > 19 {
			effectiveLevel = 19
		}

		// Pagu is in column 4
		pagu := parseFlexibleDecimal(safeGetSlice(row, 4))

		parentLevel := -1
		for i := effectiveLevel - 1; i >= 0; i-- {
			if lastNodeAtLevel[i].Kode != "" {
				parentLevel = i
				break
			}
		}

		node := AnggaranNodeImport{
			Level:         effectiveLevel,
			Jenis:         jenis,
			Kode:          shortKode,
			Uraian:        uraian,
			PaguRevisi:    pagu,
			LockPagu:      "0",
			RealisasiLalu: "0",
			RealisasiIni:  "0",
			RealisasiSD:   "0",
			Persentase:    "0",
			Sisa:          pagu,
			ParentLevel:   parentLevel,
		}

		result = append(result, node)

		lastNodeAtLevel[effectiveLevel] = node
		for i := effectiveLevel + 1; i < 20; i++ {
			lastNodeAtLevel[i] = AnggaranNodeImport{}
		}
	}

	return result
}
