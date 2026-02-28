package util

import (
	"math"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func TestUUIDHelpers(t *testing.T) {
	pgID := NewPgUUID()
	if !pgID.Valid {
		t.Fatalf("NewPgUUID should produce valid UUID")
	}

	raw := uuid.New()
	converted := UUIDToPgUUID(raw)
	if !converted.Valid || converted.Bytes != raw {
		t.Fatalf("UUIDToPgUUID mismatch: got=%v want=%v", converted.Bytes, raw)
	}
}

func TestFloatAndNumericHelpers(t *testing.T) {
	n := Float64ToNumeric(123.456)
	if got := NumericToFloat64(n); math.Abs(got-123.456) > 0.0001 {
		t.Fatalf("unexpected float roundtrip: got=%f", got)
	}

	ptr := NumericToFloat32Ptr(n)
	if ptr == nil {
		t.Fatalf("NumericToFloat32Ptr should return non-nil for valid numeric")
	}
	if math.Abs(float64(*ptr)-123.456) > 0.01 {
		t.Fatalf("unexpected float32 ptr value: %f", *ptr)
	}

	if got := NumericToFloat32Ptr(pgtype.Numeric{}); got != nil {
		t.Fatalf("NumericToFloat32Ptr should return nil for invalid numeric")
	}
}

func TestFloat64ToNumeric_InfinityFallsBackToZero(t *testing.T) {
	for _, in := range []float64{math.Inf(1), math.Inf(-1)} {
		n := Float64ToNumeric(in)
		if got := NumericToDecimalString(n); got != "0" {
			t.Fatalf("expected fallback to zero for %v, got %q", in, got)
		}
	}
}

func TestNumericToFloat64_ErrorReturnsZero(t *testing.T) {
	var huge pgtype.Numeric
	if err := huge.Scan(strings.Repeat("9", 400)); err != nil {
		t.Fatalf("failed to build huge numeric: %v", err)
	}

	if got := NumericToFloat64(huge); got != 0 {
		t.Fatalf("expected 0 on conversion error, got %v", got)
	}
}

func TestNumericToDecimalString_AdditionalBranches(t *testing.T) {
	if got := NumericToDecimalString(pgtype.Numeric{Valid: true}); got != "<nil>" {
		t.Fatalf("expected <nil> JSON rendering for valid-nil numeric, got %q", got)
	}

	if got := NumericToDecimalString(pgtype.Numeric{Valid: true, NaN: true}); got != "NaN" {
		t.Fatalf("expected quoted NaN branch to unwrap to NaN, got %q", got)
	}
}
