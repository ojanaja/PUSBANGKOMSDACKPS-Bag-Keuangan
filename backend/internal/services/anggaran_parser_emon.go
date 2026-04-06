package services

import (
	"fmt"
	"strconv"
	"strings"
)

// ParseAnggaranEMON parses the EMON (e-Monitoring) format Excel data.
// The format is a flat table with columns:
// A=No, B=Kode, C=Kegiatan/KRO/RO/Paket, D=Target Vol, E=Satuan,
// F=Lokasi, G=Jenis Paket, H=Metode Pemilihan, I=Sumber Dana,
// J=Pagu (Rp Ribu), K=Realisasi (Rp Ribu), L=Blokir (Rp Ribu),
// M=Pengembalian (Rp Ribu), N=Keu (%), O=Fisik (%)
//
// Hierarchy is determined by the Kode pattern:
// 7769             → Level 0 (Program/Kegiatan)
// 7769.AFA         → Level 1 (KRO)
// 7769.AFA.001     → Level 2 (RO)
// 7769.AFA.001.100.A → Level 3 (Paket)
//
// Values in Rp Ribu are multiplied by 1000 to get full Rupiah.
func ParseAnggaranEMON(rows [][]string) []AnggaranNodeImport {
	var result []AnggaranNodeImport
	var lastNodeAtLevel [10]AnggaranNodeImport

	dataStarted := false

	for _, row := range rows {
		if len(row) < 3 {
			continue
		}

		// Skip header rows
		col0 := strings.TrimSpace(safeGetSlice(row, 0))
		col1 := strings.TrimSpace(safeGetSlice(row, 1))
		col2 := strings.TrimSpace(safeGetSlice(row, 2))

		if strings.ToUpper(col0) == "NO" || strings.ToUpper(col0) == "TOTAL" {
			continue
		}
		if strings.Contains(strings.ToUpper(col0), "(RP") {
			continue
		}

		// We need a valid Kode (col B)
		if col1 == "" {
			continue
		}

		// Detect if we've started reading data (first row with numeric No)
		if !dataStarted {
			if _, err := strconv.Atoi(col0); err == nil {
				dataStarted = true
			} else {
				continue
			}
		}

		// Parse hierarchy from Kode parts
		kode := col1
		level, jenis := detectEMONLevel(kode)

		uraian := strings.TrimSpace(col2)

		// Parse financial values - EMON stores in Rp Ribu (thousands)
		paguRibu := parseFlexibleDecimalEMON(safeGetSlice(row, 9))   // col J
		realRibu := parseFlexibleDecimalEMON(safeGetSlice(row, 10))  // col K
		blokirRibu := parseFlexibleDecimalEMON(safeGetSlice(row, 11)) // col L = lock_pagu
		// col M = pengembalian, skipped
		keuPersen := parseFlexibleDecimalEMON(safeGetSlice(row, 13)) // col N = %

		// Convert from ribuan to full rupiah (*1000)
		pagu := multiplyByThousand(paguRibu)
		realisasi := multiplyByThousand(realRibu)
		blokir := multiplyByThousand(blokirRibu)
		sisa := subtractDecimal(pagu, realisasi)

		// Determine parent
		parentLevel := -1
		for i := level - 1; i >= 0; i-- {
			if lastNodeAtLevel[i].Kode != "" {
				parentLevel = i
				break
			}
		}

		node := AnggaranNodeImport{
			Level:         level,
			Jenis:         jenis,
			Kode:          kode,
			Uraian:        uraian,
			PaguRevisi:    pagu,
			LockPagu:      blokir,
			RealisasiLalu: "0",
			RealisasiIni:  realisasi,
			RealisasiSD:   realisasi,
			Persentase:    keuPersen,
			Sisa:          sisa,
			ParentLevel:   parentLevel,
		}

		result = append(result, node)

		lastNodeAtLevel[level] = node
		for i := level + 1; i < 10; i++ {
			lastNodeAtLevel[i] = AnggaranNodeImport{}
		}
	}

	return result
}

// detectEMONLevel determines the hierarchy level and type from the kode pattern.
// Examples:
//   7769                → 0, PROGRAM
//   7769.AFA            → 1, KRO
//   7769.AFA.001        → 2, RO
//   7769.AFA.001.100.A  → 3, PAKET (or more segments)
func detectEMONLevel(kode string) (int, string) {
	parts := strings.Split(kode, ".")
	switch len(parts) {
	case 1:
		return 0, "PROGRAM"
	case 2:
		return 1, "KRO"
	case 3:
		return 2, "RO"
	default:
		// 4+ parts = PAKET level
		return 3, "PAKET"
	}
}

func parseFlexibleDecimalEMON(raw string) string {
	return parseFlexibleDecimal(raw) // reuse the existing parser
}

// multiplyByThousand multiplies a decimal string by 1000.
// Simple approach: if the number has no decimals, just append "000".
// If it has decimals, handle appropriately.
func multiplyByThousand(val string) string {
	if val == "" || val == "0" {
		return "0"
	}

	// Handle negative
	negative := false
	work := val
	if strings.HasPrefix(work, "-") {
		negative = true
		work = work[1:]
	}

	dotIdx := strings.Index(work, ".")
	if dotIdx == -1 {
		// Integer: just append 000
		result := work + "000"
		if negative {
			return "-" + result
		}
		return result
	}

	// Has decimal: shift decimal point 3 places right
	intPart := work[:dotIdx]
	fracPart := work[dotIdx+1:]

	// Pad fracPart to at least 3 characters
	for len(fracPart) < 3 {
		fracPart += "0"
	}

	// Take first 3 chars of fracPart as new integer part addition
	newIntAppend := fracPart[:3]
	remaining := fracPart[3:]

	result := intPart + newIntAppend
	// Remove leading zeros
	result = strings.TrimLeft(result, "0")
	if result == "" {
		result = "0"
	}

	if remaining != "" {
		// Remove trailing zeros from remaining
		remaining = strings.TrimRight(remaining, "0")
		if remaining != "" {
			result += "." + remaining
		}
	}

	if negative {
		return "-" + result
	}
	return result
}

// subtractDecimal subtracts b from a as decimal strings.
func subtractDecimal(a, b string) string {
	fa, _ := strconv.ParseFloat(a, 64)
	fb, _ := strconv.ParseFloat(b, 64)
	diff := fa - fb
	if diff == 0 {
		return "0"
	}
	return fmt.Sprintf("%.0f", diff)
}
