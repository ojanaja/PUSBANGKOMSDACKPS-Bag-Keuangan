package util

import (
	"fmt"
	"strconv"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func NewPgUUID() pgtype.UUID {
	id := uuid.New()
	return pgtype.UUID{Bytes: id, Valid: true}
}

func UUIDToPgUUID(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func Float64ToNumeric(f float64) pgtype.Numeric {
	var n pgtype.Numeric
	s := strconv.FormatFloat(f, 'g', -1, 64)
	if err := n.Scan(s); err != nil {
		_ = n.Scan("0")
	}
	return n
}

func DecimalStringToNumeric(s string) (pgtype.Numeric, error) {
	var n pgtype.Numeric
	if err := n.Scan(s); err != nil {
		return n, fmt.Errorf("scan numeric %q: %w", s, err)
	}
	return n, nil
}

func NumericToFloat64(n pgtype.Numeric) float64 {
	f, err := n.Float64Value()
	if err != nil {
		return 0
	}
	return f.Float64
}

func NumericToFloat32Ptr(n pgtype.Numeric) *float32 {
	if !n.Valid {
		return nil
	}
	v := float32(NumericToFloat64(n))
	return &v
}

func NumericToDecimalString(n pgtype.Numeric) string {
	if !n.Valid {
		return "0"
	}

	b, _ := n.MarshalJSON()
	if len(b) >= 2 && b[0] == '"' && b[len(b)-1] == '"' {
		return string(b[1 : len(b)-1])
	}
	return string(b)
}
