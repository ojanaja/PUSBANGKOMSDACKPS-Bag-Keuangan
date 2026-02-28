package services

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/util"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

type serviceFakeRows struct {
	idx  int
	data [][]any
	err  error
}

func (r *serviceFakeRows) Close()                                       {}
func (r *serviceFakeRows) Err() error                                   { return r.err }
func (r *serviceFakeRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (r *serviceFakeRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (r *serviceFakeRows) Next() bool {
	if r.idx >= len(r.data) {
		return false
	}
	r.idx++
	return true
}
func (r *serviceFakeRows) Scan(dest ...any) error {
	if r.idx == 0 || r.idx > len(r.data) {
		return errors.New("scan called without current row")
	}
	row := r.data[r.idx-1]
	if len(dest) != len(row) {
		return errors.New("destination length mismatch")
	}
	for i := range dest {
		dv := reflect.ValueOf(dest[i])
		if dv.Kind() != reflect.Ptr || dv.IsNil() {
			return errors.New("destination must be non-nil pointer")
		}
		rv := reflect.ValueOf(row[i])
		if !rv.IsValid() {
			dv.Elem().Set(reflect.Zero(dv.Elem().Type()))
			continue
		}
		if !rv.Type().AssignableTo(dv.Elem().Type()) {
			return errors.New("row value type not assignable to destination")
		}
		dv.Elem().Set(rv)
	}
	return nil
}
func (r *serviceFakeRows) Values() ([]any, error) {
	if r.idx == 0 || r.idx > len(r.data) {
		return nil, errors.New("values called without current row")
	}
	return r.data[r.idx-1], nil
}
func (r *serviceFakeRows) RawValues() [][]byte { return nil }
func (r *serviceFakeRows) Conn() *pgx.Conn     { return nil }

type serviceFakeRow struct {
	data []any
	err  error
}

func (r *serviceFakeRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	if len(dest) != len(r.data) {
		return errors.New("destination length mismatch")
	}
	for i := range dest {
		dv := reflect.ValueOf(dest[i])
		if dv.Kind() != reflect.Ptr || dv.IsNil() {
			return errors.New("destination must be non-nil pointer")
		}
		rv := reflect.ValueOf(r.data[i])
		if !rv.IsValid() {
			dv.Elem().Set(reflect.Zero(dv.Elem().Type()))
			continue
		}
		if !rv.Type().AssignableTo(dv.Elem().Type()) {
			return errors.New("row value type not assignable to destination")
		}
		dv.Elem().Set(rv)
	}
	return nil
}

type serviceFakeDBTX struct {
	queryFn    func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
	queryRowFn func(ctx context.Context, sql string, args ...interface{}) pgx.Row
}

func (f *serviceFakeDBTX) Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, errors.New("not implemented")
}
func (f *serviceFakeDBTX) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	if f.queryFn == nil {
		return nil, errors.New("queryFn not set")
	}
	return f.queryFn(ctx, sql, args...)
}
func (f *serviceFakeDBTX) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	if f.queryRowFn == nil {
		return &serviceFakeRow{err: errors.New("queryRowFn not set")}
	}
	return f.queryRowFn(ctx, sql, args...)
}

func TestEWSEngine_RunAllChecks(t *testing.T) {
	paketID := uuid.New()

	makeQueries := func(docQueryErr bool) *db.Queries {
		fake := &serviceFakeDBTX{
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				switch {
				case strings.Contains(sql, "-- name: ListPaketPekerjaan :many"):
					return &serviceFakeRows{data: [][]any{{
						pgtype.UUID{Bytes: paketID, Valid: true},
						"Paket EWS",
						"Satker",
						"Lokasi",
						util.Float64ToNumeric(1000),
						"DRAFT",
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
					}}}, nil
				case strings.Contains(sql, "-- name: GetPaketTargetsByPaketIDs :many"):
					return &serviceFakeRows{data: [][]any{{
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.UUID{Bytes: paketID, Valid: true},
						int32(1),
						util.Float64ToNumeric(60),
						util.Float64ToNumeric(40),
					}}}, nil
				case strings.Contains(sql, "-- name: GetRealisasiFisikByPaketIDs :many"):
					return &serviceFakeRows{data: [][]any{{
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.UUID{Bytes: paketID, Valid: true},
						int32(1),
						util.Float64ToNumeric(10),
						pgtype.Text{},
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Text{},
						pgtype.UUID{},
						pgtype.Timestamptz{},
						pgtype.Text{},
						pgtype.Text{},
					}}}, nil
				case strings.Contains(sql, "-- name: GetDocumentsByPaketIDs :many"):
					if docQueryErr {
						return nil, errors.New("doc query error")
					}
					return &serviceFakeRows{data: [][]any{}}, nil
				default:
					return nil, errors.New("unexpected query")
				}
			},
		}
		return db.New(fake)
	}

	t.Run("produces warning and doc alerts", func(t *testing.T) {
		engine := NewEWSEngine(makeQueries(false))
		alerts := engine.RunAllChecks(context.Background())
		if len(alerts) < 2 {
			t.Fatalf("expected at least 2 alerts, got %d", len(alerts))
		}

		hasDeviasiWarning := false
		hasDocCritical := false
		for _, a := range alerts {
			if a.Rule == "DEVIASI_FISIK_GT_10" {
				hasDeviasiWarning = true
			}
			if a.Rule == "DOKUMEN_BUKTI_KOSONG" {
				hasDocCritical = true
			}
		}
		if !hasDeviasiWarning || !hasDocCritical {
			t.Fatalf("expected both deviation warning and missing-doc critical alerts, got: %+v", alerts)
		}
	})

	t.Run("continues when docs query fails", func(t *testing.T) {
		engine := NewEWSEngine(makeQueries(true))
		alerts := engine.RunAllChecks(context.Background())
		if len(alerts) == 0 {
			t.Fatalf("expected alerts even when docs query fails")
		}
	})
}

func TestActivityLogger_Log(t *testing.T) {
	userID := uuid.New()
	targetID := uuid.New()

	fake := &serviceFakeDBTX{
		queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			if !strings.Contains(sql, "-- name: CreateActivityLog :one") {
				return &serviceFakeRow{err: errors.New("unexpected query row")}
			}
			return &serviceFakeRow{data: []any{
				pgtype.UUID{Bytes: uuid.New(), Valid: true},
				pgtype.UUID{Bytes: userID, Valid: true},
				"ACTION",
				pgtype.Text{String: "paket", Valid: true},
				pgtype.UUID{Bytes: targetID, Valid: true},
				[]byte(`{"ok":true}`),
				pgtype.Text{String: "127.0.0.1", Valid: true},
				pgtype.Text{String: "ua", Valid: true},
				pgtype.Timestamptz{Time: time.Now(), Valid: true},
			}}
		},
	}

	logger := NewActivityLogger(db.New(fake))
	logger.Log(context.Background(), userID, "ACTION", "paket", &targetID, map[string]interface{}{"ok": true}, "127.0.0.1", "ua")

	logger.Log(context.Background(), userID, "ACTION2", "", nil, nil, "", "")
}

func TestActivityLogger_Log_ErrorPaths(t *testing.T) {
	userID := uuid.New()

	fake := &serviceFakeDBTX{
		queryRowFn: func(ctx context.Context, sql string, args ...interface{}) pgx.Row {
			if !strings.Contains(sql, "-- name: CreateActivityLog :one") {
				return &serviceFakeRow{err: errors.New("unexpected query row")}
			}
			return &serviceFakeRow{err: errors.New("insert failed")}
		},
	}

	logger := NewActivityLogger(db.New(fake))
	logger.Log(
		context.Background(),
		userID,
		"ACTION_ERR",
		"paket",
		nil,
		map[string]interface{}{"bad": func() {}},
		"127.0.0.1",
		"ua",
	)
}

func TestEWSEngine_StartCron(t *testing.T) {
	var runCount int32

	fake := &serviceFakeDBTX{
		queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			if strings.Contains(sql, "-- name: ListPaketPekerjaan :many") {
				atomic.AddInt32(&runCount, 1)
				return nil, errors.New("forced list error")
			}
			return nil, errors.New("unexpected query")
		},
	}

	engine := NewEWSEngine(db.New(fake))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine.StartCron(ctx, 10*time.Millisecond)

	deadline := time.Now().Add(300 * time.Millisecond)
	for atomic.LoadInt32(&runCount) == 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}

	if atomic.LoadInt32(&runCount) == 0 {
		t.Fatalf("expected RunAllChecks to be triggered at least once by cron")
	}

	cancel()
	before := atomic.LoadInt32(&runCount)
	time.Sleep(30 * time.Millisecond)
	after := atomic.LoadInt32(&runCount)
	if after > before+1 {
		t.Fatalf("unexpected extra cron runs after cancel: before=%d after=%d", before, after)
	}
}

func TestEWSEngine_StartCron_TickerPathRunsMoreThanOnce(t *testing.T) {
	var runCount int32

	fake := &serviceFakeDBTX{
		queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			if strings.Contains(sql, "-- name: ListPaketPekerjaan :many") {
				atomic.AddInt32(&runCount, 1)
				return &serviceFakeRows{data: [][]any{}}, nil
			}
			return nil, errors.New("unexpected query")
		},
	}

	engine := NewEWSEngine(db.New(fake))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine.StartCron(ctx, 10*time.Millisecond)

	deadline := time.Now().Add(400 * time.Millisecond)
	for atomic.LoadInt32(&runCount) < 2 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}

	if atomic.LoadInt32(&runCount) < 2 {
		t.Fatalf("expected at least two runs (initial + ticker), got %d", atomic.LoadInt32(&runCount))
	}
}

func TestEWSEngine_RunAllChecks_EdgeBranches(t *testing.T) {
	t.Run("returns empty when list paket is empty", func(t *testing.T) {
		fake := &serviceFakeDBTX{
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				if strings.Contains(sql, "-- name: ListPaketPekerjaan :many") {
					return &serviceFakeRows{data: [][]any{}}, nil
				}
				return nil, errors.New("unexpected query")
			},
		}
		alerts := NewEWSEngine(db.New(fake)).RunAllChecks(context.Background())
		if len(alerts) != 0 {
			t.Fatalf("expected no alerts, got %d", len(alerts))
		}
	})

	t.Run("returns empty when paket IDs are invalid", func(t *testing.T) {
		fake := &serviceFakeDBTX{
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				if strings.Contains(sql, "-- name: ListPaketPekerjaan :many") {
					return &serviceFakeRows{data: [][]any{{
						pgtype.UUID{},
						"Invalid Paket",
						"Satker",
						"Lokasi",
						util.Float64ToNumeric(1000),
						"DRAFT",
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
					}}}, nil
				}
				return nil, errors.New("unexpected query")
			},
		}
		alerts := NewEWSEngine(db.New(fake)).RunAllChecks(context.Background())
		if len(alerts) != 0 {
			t.Fatalf("expected no alerts, got %d", len(alerts))
		}
	})

	t.Run("returns empty when loading targets fails", func(t *testing.T) {
		paketID := uuid.New()
		fake := &serviceFakeDBTX{
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				switch {
				case strings.Contains(sql, "-- name: ListPaketPekerjaan :many"):
					return &serviceFakeRows{data: [][]any{{
						pgtype.UUID{Bytes: paketID, Valid: true},
						"Paket A",
						"Satker",
						"Lokasi",
						util.Float64ToNumeric(1000),
						"DRAFT",
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
					}}}, nil
				case strings.Contains(sql, "-- name: GetPaketTargetsByPaketIDs :many"):
					return nil, errors.New("targets failed")
				default:
					return nil, errors.New("unexpected query")
				}
			},
		}
		alerts := NewEWSEngine(db.New(fake)).RunAllChecks(context.Background())
		if len(alerts) != 0 {
			t.Fatalf("expected no alerts, got %d", len(alerts))
		}
	})

	t.Run("returns empty when loading realisasi fails", func(t *testing.T) {
		paketID := uuid.New()
		fake := &serviceFakeDBTX{
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				switch {
				case strings.Contains(sql, "-- name: ListPaketPekerjaan :many"):
					return &serviceFakeRows{data: [][]any{{
						pgtype.UUID{Bytes: paketID, Valid: true},
						"Paket B",
						"Satker",
						"Lokasi",
						util.Float64ToNumeric(1000),
						"DRAFT",
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
					}}}, nil
				case strings.Contains(sql, "-- name: GetPaketTargetsByPaketIDs :many"):
					return &serviceFakeRows{data: [][]any{}}, nil
				case strings.Contains(sql, "-- name: GetRealisasiFisikByPaketIDs :many"):
					return nil, errors.New("realisasi failed")
				default:
					return nil, errors.New("unexpected query")
				}
			},
		}
		alerts := NewEWSEngine(db.New(fake)).RunAllChecks(context.Background())
		if len(alerts) != 0 {
			t.Fatalf("expected no alerts, got %d", len(alerts))
		}
	})

	t.Run("produces PENCAIRAN_TANPA_FISIK when target exists without realization", func(t *testing.T) {
		paketID := uuid.New()
		fake := &serviceFakeDBTX{
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				switch {
				case strings.Contains(sql, "-- name: ListPaketPekerjaan :many"):
					return &serviceFakeRows{data: [][]any{{
						pgtype.UUID{Bytes: paketID, Valid: true},
						"Paket C",
						"Satker",
						"Lokasi",
						util.Float64ToNumeric(1000),
						"DRAFT",
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
						pgtype.Timestamptz{Time: time.Now(), Valid: true},
					}}}, nil
				case strings.Contains(sql, "-- name: GetPaketTargetsByPaketIDs :many"):
					return &serviceFakeRows{data: [][]any{{
						pgtype.UUID{Bytes: uuid.New(), Valid: true},
						pgtype.UUID{Bytes: paketID, Valid: true},
						int32(1),
						util.Float64ToNumeric(50),
						util.Float64ToNumeric(25),
					}}}, nil
				case strings.Contains(sql, "-- name: GetRealisasiFisikByPaketIDs :many"):
					return &serviceFakeRows{data: [][]any{}}, nil
				case strings.Contains(sql, "-- name: GetDocumentsByPaketIDs :many"):
					return &serviceFakeRows{data: [][]any{}}, nil
				default:
					return nil, errors.New("unexpected query")
				}
			},
		}

		alerts := NewEWSEngine(db.New(fake)).RunAllChecks(context.Background())
		hasRule := false
		for _, a := range alerts {
			if a.Rule == "PENCAIRAN_TANPA_FISIK" {
				hasRule = true
				break
			}
		}
		if !hasRule {
			t.Fatalf("expected PENCAIRAN_TANPA_FISIK alert, got %+v", alerts)
		}
	})

	t.Run("skips invalid IDs and uses docs map when available", func(t *testing.T) {
		paketID := uuid.New()
		fake := &serviceFakeDBTX{
			queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
				switch {
				case strings.Contains(sql, "-- name: ListPaketPekerjaan :many"):
					return &serviceFakeRows{data: [][]any{
						{
							pgtype.UUID{},
							"Invalid Paket",
							"Satker",
							"Lokasi",
							util.Float64ToNumeric(1000),
							"DRAFT",
							pgtype.UUID{Bytes: uuid.New(), Valid: true},
							pgtype.Timestamptz{Time: time.Now(), Valid: true},
							pgtype.Timestamptz{Time: time.Now(), Valid: true},
						},
						{
							pgtype.UUID{Bytes: paketID, Valid: true},
							"Valid Paket",
							"Satker",
							"Lokasi",
							util.Float64ToNumeric(1000),
							"DRAFT",
							pgtype.UUID{Bytes: uuid.New(), Valid: true},
							pgtype.Timestamptz{Time: time.Now(), Valid: true},
							pgtype.Timestamptz{Time: time.Now(), Valid: true},
						},
					}}, nil
				case strings.Contains(sql, "-- name: GetPaketTargetsByPaketIDs :many"):
					return &serviceFakeRows{data: [][]any{
						{pgtype.UUID{Bytes: uuid.New(), Valid: true}, pgtype.UUID{}, int32(1), util.Float64ToNumeric(5), util.Float64ToNumeric(5)},
						{pgtype.UUID{Bytes: uuid.New(), Valid: true}, pgtype.UUID{Bytes: paketID, Valid: true}, int32(1), util.Float64ToNumeric(10), util.Float64ToNumeric(10)},
					}}, nil
				case strings.Contains(sql, "-- name: GetRealisasiFisikByPaketIDs :many"):
					return &serviceFakeRows{data: [][]any{
						{pgtype.UUID{Bytes: uuid.New(), Valid: true}, pgtype.UUID{}, int32(1), util.Float64ToNumeric(9), pgtype.Text{}, pgtype.UUID{Bytes: uuid.New(), Valid: true}, pgtype.Timestamptz{Time: time.Now(), Valid: true}, pgtype.Text{}, pgtype.UUID{}, pgtype.Timestamptz{}, pgtype.Text{}, pgtype.Text{}},
						{pgtype.UUID{Bytes: uuid.New(), Valid: true}, pgtype.UUID{Bytes: paketID, Valid: true}, int32(1), util.Float64ToNumeric(9), pgtype.Text{}, pgtype.UUID{Bytes: uuid.New(), Valid: true}, pgtype.Timestamptz{Time: time.Now(), Valid: true}, pgtype.Text{}, pgtype.UUID{}, pgtype.Timestamptz{}, pgtype.Text{}, pgtype.Text{}},
					}}, nil
				case strings.Contains(sql, "-- name: GetDocumentsByPaketIDs :many"):
					return &serviceFakeRows{data: [][]any{
						{pgtype.UUID{Bytes: uuid.New(), Valid: true}, pgtype.UUID{}, int32(1), "FISIK", "FOTO", "hash-invalid", "x.jpg", "image/jpeg", int64(1), pgtype.UUID{Bytes: uuid.New(), Valid: true}, pgtype.Timestamptz{Time: time.Now(), Valid: true}, pgtype.Text{}, pgtype.UUID{}, pgtype.Timestamptz{}, pgtype.Text{}, pgtype.Text{}},
						{pgtype.UUID{Bytes: uuid.New(), Valid: true}, pgtype.UUID{Bytes: paketID, Valid: true}, int32(1), "FISIK", "FOTO", "hash-valid", "x.jpg", "image/jpeg", int64(1), pgtype.UUID{Bytes: uuid.New(), Valid: true}, pgtype.Timestamptz{Time: time.Now(), Valid: true}, pgtype.Text{}, pgtype.UUID{}, pgtype.Timestamptz{}, pgtype.Text{}, pgtype.Text{}},
					}}, nil
				default:
					return nil, errors.New("unexpected query")
				}
			},
		}

		alerts := NewEWSEngine(db.New(fake)).RunAllChecks(context.Background())
		if len(alerts) != 0 {
			t.Fatalf("expected no alerts, got %+v", alerts)
		}
	})
}
