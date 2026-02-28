package util

import (
	"regexp"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
)

func TestDecimalStringToNumeric_RoundTripStable(t *testing.T) {
	decimalLike := regexp.MustCompile(`^-?\d+(\.\d+)?$`)

	cases := []string{
		"0",
		"1",
		"-1",
		"0.1",
		"1000000",
		"999999999999999999999999.123456789",
	}

	for _, in := range cases {
		n1, err := DecimalStringToNumeric(in)
		if err != nil {
			t.Fatalf("DecimalStringToNumeric(%q) unexpected error: %v", in, err)
		}

		out := NumericToDecimalString(n1)
		if !decimalLike.MatchString(out) {
			t.Fatalf("unexpected decimal output: in=%q out=%q", in, out)
		}

		n2, err := DecimalStringToNumeric(out)
		if err != nil {
			t.Fatalf("DecimalStringToNumeric(%q) (from output) unexpected error: %v", out, err)
		}
		out2 := NumericToDecimalString(n2)
		if out2 != out {
			t.Fatalf("output not stable: out=%q out2=%q", out, out2)
		}
	}
}

func TestDecimalStringToNumeric_Invalid(t *testing.T) {
	if _, err := DecimalStringToNumeric("not-a-number"); err == nil {
		t.Fatalf("expected error")
	}
}

func TestNumericToDecimalString_Null(t *testing.T) {
	out := NumericToDecimalString(pgtype.Numeric{})
	if out != "0" {
		t.Fatalf("got %q, want %q", out, "0")
	}
}
