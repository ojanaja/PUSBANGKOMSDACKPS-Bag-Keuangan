package handlers

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func newPgUUID() pgtype.UUID {
	id := uuid.New()
	return pgtype.UUID{Bytes: id, Valid: true}
}

func uuidToPgUUID(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func float64ToNumeric(f float64) pgtype.Numeric {
	var n pgtype.Numeric
	n.Scan(fmt.Sprintf("%f", f))
	return n
}

func numericToFloat64(n pgtype.Numeric) float64 {
	f, _ := n.Float64Value()
	return f.Float64
}

func numericToFloat32Ptr(n pgtype.Numeric) *float32 {
	if !n.Valid {
		return nil
	}
	f, _ := n.Float64Value()
	v := float32(f.Float64)
	return &v
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
