package handlers

import (
	"strings"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/util"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func newPgUUID() pgtype.UUID {
	return util.NewPgUUID()
}

func uuidToPgUUID(id uuid.UUID) pgtype.UUID {
	return util.UUIDToPgUUID(id)
}

func float64ToNumeric(f float64) pgtype.Numeric {
	return util.Float64ToNumeric(f)
}

func numericToFloat64(n pgtype.Numeric) float64 {
	return util.NumericToFloat64(n)
}

func numericToFloat32Ptr(n pgtype.Numeric) *float32 {
	return util.NumericToFloat32Ptr(n)
}

func numericToDecimalString(n pgtype.Numeric) string {
	return util.NumericToDecimalString(n)
}

func decimalStringToNumeric(s string) (pgtype.Numeric, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		s = "0"
	}
	return util.DecimalStringToNumeric(s)
}

func textPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}

func int4Ptr(n pgtype.Int4) *int {
	if !n.Valid {
		return nil
	}
	v := int(n.Int32)
	return &v
}

func ptr[T any](v T) *T {
	return &v
}

func uuidToOpenAPI(id pgtype.UUID) *openapi_types.UUID {
	u := openapi_types.UUID(id.Bytes)
	return &u
}

func pgUUIDToOpenAPI(id pgtype.UUID) *openapi_types.UUID {
	u := openapi_types.UUID(id.Bytes)
	return &u
}
