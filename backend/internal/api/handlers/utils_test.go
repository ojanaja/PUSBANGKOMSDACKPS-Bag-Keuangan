package handlers

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func TestDecimalStringToNumeric_TrimAndEmpty(t *testing.T) {
	n, err := decimalStringToNumeric("  ")
	if err != nil {
		t.Fatalf("decimalStringToNumeric returned error: %v", err)
	}
	if got := numericToDecimalString(n); got != "0" {
		t.Fatalf("unexpected decimal output: got=%q want=%q", got, "0")
	}

	n2, err := decimalStringToNumeric(" 123.45 ")
	if err != nil {
		t.Fatalf("decimalStringToNumeric returned error: %v", err)
	}
	if got := numericToDecimalString(n2); got != "123.45" {
		t.Fatalf("unexpected decimal output: got=%q want=%q", got, "123.45")
	}
}

func TestTextPtrAndInt4Ptr(t *testing.T) {
	if got := textPtr(pgtype.Text{}); got != nil {
		t.Fatalf("expected nil for invalid text")
	}
	text := textPtr(pgtype.Text{String: "abc", Valid: true})
	if text == nil || *text != "abc" {
		t.Fatalf("unexpected textPtr result: %v", text)
	}

	if got := int4Ptr(pgtype.Int4{}); got != nil {
		t.Fatalf("expected nil for invalid int4")
	}
	intv := int4Ptr(pgtype.Int4{Int32: 42, Valid: true})
	if intv == nil || *intv != 42 {
		t.Fatalf("unexpected int4Ptr result: %v", intv)
	}
}

func TestPtrHelper(t *testing.T) {
	v := ptr("hello")
	if v == nil || *v != "hello" {
		t.Fatalf("unexpected ptr helper result: %v", v)
	}
}

func TestUUIDConversionHelpers(t *testing.T) {
	id := uuid.New()
	pgID := uuidToPgUUID(id)
	if !pgID.Valid {
		t.Fatalf("uuidToPgUUID should return valid pgtype.UUID")
	}

	openapiA := uuidToOpenAPI(pgID)
	openapiB := pgUUIDToOpenAPI(pgID)
	if openapiA == nil || openapiB == nil {
		t.Fatalf("expected non-nil OpenAPI UUID pointers")
	}

	if uuid.UUID(*openapiA) != id {
		t.Fatalf("uuidToOpenAPI mismatch: got=%s want=%s", uuid.UUID(*openapiA), id)
	}
	if uuid.UUID(*openapiB) != id {
		t.Fatalf("pgUUIDToOpenAPI mismatch: got=%s want=%s", uuid.UUID(*openapiB), id)
	}

	_ = openapi_types.UUID{}
}

// Mock DB structures for testing
type handlerFakeDBTX struct {
	db.DBTX
	queryRowFn func(context.Context, string, ...any) pgx.Row
	execFn     func(context.Context, string, ...any) (pgconn.CommandTag, error)
	queryFn    func(context.Context, string, ...any) (pgx.Rows, error)
}

func (m *handlerFakeDBTX) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	if m.queryRowFn != nil {
		return m.queryRowFn(ctx, sql, args...)
	}
	return &handlerFakeRow{err: errors.New("QueryRow not implemented")}
}

func (m *handlerFakeDBTX) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	if m.execFn != nil {
		return m.execFn(ctx, sql, args...)
	}
	return pgconn.CommandTag{}, errors.New("Exec not implemented")
}

func (m *handlerFakeDBTX) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	if m.queryFn != nil {
		return m.queryFn(ctx, sql, args...)
	}
	return nil, errors.New("Query not implemented")
}

type handlerFakeRow struct {
	data []any
	err  error
}

func (r *handlerFakeRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	if len(dest) != len(r.data) {
		return fmt.Errorf("Scan: expected %d columns, got %d", len(r.data), len(dest))
	}
	for i := range dest {
		switch d := dest[i].(type) {
		case *string:
			*d = r.data[i].(string)
		case *int32:
			*d = r.data[i].(int32)
		case *pgtype.UUID:
			*d = r.data[i].(pgtype.UUID)
		case *pgtype.Numeric:
			*d = r.data[i].(pgtype.Numeric)
		case *pgtype.Text:
			*d = r.data[i].(pgtype.Text)
		default:
			// Fallback or generic assignment if needed
			return fmt.Errorf("Scan: unsupported type %T", d)
		}
	}
	return nil
}
