package services

import (
	"errors"
	"io"
	"strings"
	"testing"
)

type headerErrReader struct{}

func (headerErrReader) Read(_ []byte) (int, error) {
	return 0, io.ErrUnexpectedEOF
}

const anggaranCSVHeader = "Program Kode,Program Uraian,Kegiatan Kode,Kegiatan Uraian,Output Kode,Output Uraian,SubOutput Kode,SubOutput Uraian,Akun Kode,Akun Uraian,Pagu,Realisasi,Sisa\n"

func TestParseAnggaranCSV_SuccessWithHierarchyCarryOver(t *testing.T) {
	csv := anggaranCSVHeader +
		"PRG1,Program 1,KG1,Kegiatan 1,OUT1,Output 1,SUB1,SubOutput 1,AKN1,Akun 1,1.000,500,500\n" +
		",,, ,,, , ,AKN2,Akun 2,Rp 1.250,75,1.175\n"

	rows, err := ParseAnggaranCSV(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("ParseAnggaranCSV returned error: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(rows))
	}

	if rows[1].ProgramKode != "PRG1" || rows[1].KegiatanKode != "KG1" || rows[1].SubOutputKode != "SUB1" {
		t.Fatalf("expected hierarchy values to carry over, got row=%+v", rows[1])
	}
	if rows[1].AkunKode != "AKN2" {
		t.Fatalf("unexpected akun kode: %q", rows[1].AkunKode)
	}
	if rows[0].Pagu != "1.000" {
		t.Fatalf("unexpected pagu normalization for row 1: %q", rows[0].Pagu)
	}
	if rows[1].Pagu != "1.250" {
		t.Fatalf("unexpected pagu normalization for row 2: %q", rows[1].Pagu)
	}
}

func TestParseAnggaranCSV_MissingRequiredColumn(t *testing.T) {
	csv := "Program Kode,Program Uraian\nPRG1,Program 1\n"
	_, err := ParseAnggaranCSV(strings.NewReader(csv))
	if err == nil || !strings.Contains(err.Error(), "missing required column") {
		t.Fatalf("expected missing required column error, got: %v", err)
	}
}

func TestParseAnggaranCSV_InvalidHierarchy(t *testing.T) {
	csv := anggaranCSVHeader +
		"PRG1,Program 1,KG1,Kegiatan 1,OUT1,Output 1,SUB1,SubOutput 1,,Akun 1,100,50,50\n"

	_, err := ParseAnggaranCSV(strings.NewReader(csv))
	if err == nil || !strings.Contains(err.Error(), "invalid hierarchy/code") {
		t.Fatalf("expected invalid hierarchy/code error, got: %v", err)
	}
}

func TestParseAnggaranCSVStream_SuccessAndHandlerError(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		csv := anggaranCSVHeader +
			"PRG1,Program 1,KG1,Kegiatan 1,OUT1,Output 1,SUB1,SubOutput 1,AKN1,Akun 1,100,40,60\n" +
			",,, ,,, , ,AKN2,Akun 2,200,100,100\n"

		gotRows := 0
		count, err := ParseAnggaranCSVStream(strings.NewReader(csv), func(row AnggaranRow) error {
			gotRows++
			if row.ProgramKode == "" || row.AkunKode == "" {
				t.Fatalf("row should be populated: %+v", row)
			}
			return nil
		})
		if err != nil {
			t.Fatalf("ParseAnggaranCSVStream returned error: %v", err)
		}
		if count != 2 || gotRows != 2 {
			t.Fatalf("expected 2 rows processed, count=%d gotRows=%d", count, gotRows)
		}
	})

	t.Run("handler error", func(t *testing.T) {
		csv := anggaranCSVHeader +
			"PRG1,Program 1,KG1,Kegiatan 1,OUT1,Output 1,SUB1,SubOutput 1,AKN1,Akun 1,100,40,60\n"

		wantErr := errors.New("handler failed")
		_, err := ParseAnggaranCSVStream(strings.NewReader(csv), func(row AnggaranRow) error {
			return wantErr
		})
		if err == nil || !strings.Contains(err.Error(), "error handling CSV line") {
			t.Fatalf("expected handler error to be wrapped, got: %v", err)
		}
	})
}

func TestParseFlexibleDecimal(t *testing.T) {
	cases := []struct {
		name    string
		raw     string
		want    string
		wantErr bool
	}{
		{name: "empty", raw: "", want: "0"},
		{name: "dash", raw: "-", want: "0"},
		{name: "single dot treated as decimal", raw: "1.234", want: "1.234"},
		{name: "many dots thousands", raw: "1.234.567", want: "1234567"},
		{name: "many commas thousands", raw: "1,234,567", want: "1234567"},
		{name: "decimal comma", raw: "12,5", want: "12.5"},
		{name: "mixed locale", raw: "1.234,56", want: "1234.56"},
		{name: "currency prefix", raw: "Rp 2.000", want: "2.000"},
		{name: "leading dot", raw: ".5", want: "0.5"},
		{name: "negative leading dot", raw: "-.5", want: "-0.5"},
		{name: "cleaned invalid becomes zero", raw: "abc", want: "0"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseFlexibleDecimal(tc.raw)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("unexpected parse result: got=%q want=%q", got, tc.want)
			}
		})
	}
}

func TestParserHelperFunctions(t *testing.T) {
	if got := normalizeValue(" - "); got != "" {
		t.Fatalf("normalizeValue dash should map to empty, got=%q", got)
	}
	if got := normalizeValue("  abc  "); got != "abc" {
		t.Fatalf("normalizeValue should trim spaces, got=%q", got)
	}

	record := []string{"a", "b"}
	colIndex := map[string]int{"ok": 1, "badneg": -1, "badbig": 9}
	if got := getCell(record, colIndex, "ok"); got != "b" {
		t.Fatalf("getCell valid index mismatch: got=%q", got)
	}
	if got := getCell(record, colIndex, "missing"); got != "" {
		t.Fatalf("getCell missing key should return empty, got=%q", got)
	}
	if got := getCell(record, colIndex, "badneg"); got != "" {
		t.Fatalf("getCell negative index should return empty, got=%q", got)
	}
	if got := getCell(record, colIndex, "badbig"); got != "" {
		t.Fatalf("getCell out-of-range index should return empty, got=%q", got)
	}
}

func TestParseFlexibleDecimal_Invalid(t *testing.T) {
	if _, err := parseFlexibleDecimal("--"); err == nil {
		t.Fatalf("expected invalid decimal error")
	}
}

func TestParseAnggaranCSV_NoRows(t *testing.T) {
	_, err := ParseAnggaranCSV(strings.NewReader(anggaranCSVHeader))
	if err == nil || !strings.Contains(err.Error(), "contains no data rows") {
		t.Fatalf("expected no data rows error, got: %v", err)
	}
}

func TestParseAnggaranCSVStream_NoRowsAndHierarchyError(t *testing.T) {
	t.Run("no rows", func(t *testing.T) {
		count, err := ParseAnggaranCSVStream(strings.NewReader(anggaranCSVHeader), func(row AnggaranRow) error {
			return nil
		})
		if err == nil || !strings.Contains(err.Error(), "contains no data rows") {
			t.Fatalf("expected no data rows error, got: %v", err)
		}
		if count != 0 {
			t.Fatalf("expected count=0, got=%d", count)
		}
	})

	t.Run("invalid hierarchy", func(t *testing.T) {
		csv := anggaranCSVHeader +
			"PRG1,Program 1,KG1,Kegiatan 1,OUT1,Output 1,SUB1,SubOutput 1,,Akun 1,100,50,50\n"

		count, err := ParseAnggaranCSVStream(strings.NewReader(csv), func(row AnggaranRow) error { return nil })
		if err == nil || !strings.Contains(err.Error(), "invalid hierarchy/code") {
			t.Fatalf("expected invalid hierarchy/code error, got: %v", err)
		}
		if count != 0 {
			t.Fatalf("expected count=0 before hierarchy failure, got=%d", count)
		}
	})
}

func TestParseAnggaranCSV_ReadErrors(t *testing.T) {
	t.Run("parse csv line error", func(t *testing.T) {
		malformed := anggaranCSVHeader + "\"unterminated"
		_, err := ParseAnggaranCSV(strings.NewReader(malformed))
		if err == nil || !strings.Contains(err.Error(), "error reading CSV line") {
			t.Fatalf("expected CSV line read error, got: %v", err)
		}
	})

	t.Run("stream parse csv line error", func(t *testing.T) {
		malformed := anggaranCSVHeader + "\"unterminated"
		_, err := ParseAnggaranCSVStream(strings.NewReader(malformed), func(row AnggaranRow) error { return nil })
		if err == nil || !strings.Contains(err.Error(), "error reading CSV line") {
			t.Fatalf("expected stream CSV line read error, got: %v", err)
		}
	})
}

func TestParseAnggaranCSVStream_MissingRequiredColumn(t *testing.T) {
	_, err := ParseAnggaranCSVStream(strings.NewReader("Program Kode,Program Uraian\nPRG1,Program 1\n"), func(row AnggaranRow) error {
		return nil
	})
	if err == nil || !strings.Contains(err.Error(), "missing required column") {
		t.Fatalf("expected missing required column error, got: %v", err)
	}
}

func TestParseAnggaranCSV_HeaderReadError(t *testing.T) {
	_, err := ParseAnggaranCSV(headerErrReader{})
	if err == nil || !strings.Contains(err.Error(), "failed to read CSV header") {
		t.Fatalf("expected header read error, got: %v", err)
	}
}

func TestParseAnggaranCSVStream_HeaderReadError(t *testing.T) {
	count, err := ParseAnggaranCSVStream(headerErrReader{}, func(row AnggaranRow) error { return nil })
	if err == nil || !strings.Contains(err.Error(), "failed to read CSV header") {
		t.Fatalf("expected header read error, got: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected count=0, got=%d", count)
	}
}

func TestParseAnggaranCSV_InvalidNumericFields(t *testing.T) {
	t.Run("invalid pagu", func(t *testing.T) {
		csv := anggaranCSVHeader +
			"PRG1,Program 1,KG1,Kegiatan 1,OUT1,Output 1,SUB1,SubOutput 1,AKN1,Akun 1,--,50,50\n"
		_, err := ParseAnggaranCSV(strings.NewReader(csv))
		if err == nil || !strings.Contains(err.Error(), "invalid pagu") {
			t.Fatalf("expected invalid pagu error, got: %v", err)
		}
	})

	t.Run("invalid realisasi", func(t *testing.T) {
		csv := anggaranCSVHeader +
			"PRG1,Program 1,KG1,Kegiatan 1,OUT1,Output 1,SUB1,SubOutput 1,AKN1,Akun 1,100,--,50\n"
		_, err := ParseAnggaranCSV(strings.NewReader(csv))
		if err == nil || !strings.Contains(err.Error(), "invalid realisasi") {
			t.Fatalf("expected invalid realisasi error, got: %v", err)
		}
	})

	t.Run("invalid sisa", func(t *testing.T) {
		csv := anggaranCSVHeader +
			"PRG1,Program 1,KG1,Kegiatan 1,OUT1,Output 1,SUB1,SubOutput 1,AKN1,Akun 1,100,50,--\n"
		_, err := ParseAnggaranCSV(strings.NewReader(csv))
		if err == nil || !strings.Contains(err.Error(), "invalid sisa") {
			t.Fatalf("expected invalid sisa error, got: %v", err)
		}
	})
}

func TestParseAnggaranCSVStream_InvalidNumericFields(t *testing.T) {
	t.Run("invalid pagu", func(t *testing.T) {
		csv := anggaranCSVHeader +
			"PRG1,Program 1,KG1,Kegiatan 1,OUT1,Output 1,SUB1,SubOutput 1,AKN1,Akun 1,--,50,50\n"
		count, err := ParseAnggaranCSVStream(strings.NewReader(csv), func(row AnggaranRow) error { return nil })
		if err == nil || !strings.Contains(err.Error(), "invalid pagu") {
			t.Fatalf("expected invalid pagu error, got: %v", err)
		}
		if count != 0 {
			t.Fatalf("expected count=0 before failure, got=%d", count)
		}
	})

	t.Run("invalid realisasi", func(t *testing.T) {
		csv := anggaranCSVHeader +
			"PRG1,Program 1,KG1,Kegiatan 1,OUT1,Output 1,SUB1,SubOutput 1,AKN1,Akun 1,100,--,50\n"
		count, err := ParseAnggaranCSVStream(strings.NewReader(csv), func(row AnggaranRow) error { return nil })
		if err == nil || !strings.Contains(err.Error(), "invalid realisasi") {
			t.Fatalf("expected invalid realisasi error, got: %v", err)
		}
		if count != 0 {
			t.Fatalf("expected count=0 before failure, got=%d", count)
		}
	})

	t.Run("invalid sisa", func(t *testing.T) {
		csv := anggaranCSVHeader +
			"PRG1,Program 1,KG1,Kegiatan 1,OUT1,Output 1,SUB1,SubOutput 1,AKN1,Akun 1,100,50,--\n"
		count, err := ParseAnggaranCSVStream(strings.NewReader(csv), func(row AnggaranRow) error { return nil })
		if err == nil || !strings.Contains(err.Error(), "invalid sisa") {
			t.Fatalf("expected invalid sisa error, got: %v", err)
		}
		if count != 0 {
			t.Fatalf("expected count=0 before failure, got=%d", count)
		}
	})
}
