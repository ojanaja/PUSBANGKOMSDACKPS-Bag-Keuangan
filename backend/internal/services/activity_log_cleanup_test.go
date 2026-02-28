package services

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type cleanupFakeDBTX struct {
	execFn func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error)
}

func (f *cleanupFakeDBTX) Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
	if f.execFn != nil {
		return f.execFn(ctx, sql, args...)
	}
	return pgconn.NewCommandTag("DELETE 0"), nil
}

func (f *cleanupFakeDBTX) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	return nil, errors.New("not implemented")
}

func (f *cleanupFakeDBTX) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	return nil
}

func TestStartActivityLogCleanup_Guards(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	StartActivityLogCleanup(ctx, nil, 7, 10*time.Millisecond)

	q := db.New(&cleanupFakeDBTX{})
	StartActivityLogCleanup(ctx, q, 0, 10*time.Millisecond)
}

func TestStartActivityLogCleanup_RunsAndStops(t *testing.T) {
	var execCount int32

	fake := &cleanupFakeDBTX{execFn: func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
		atomic.AddInt32(&execCount, 1)
		return pgconn.NewCommandTag("DELETE 2"), nil
	}}

	q := db.New(fake)
	ctx, cancel := context.WithCancel(context.Background())
	StartActivityLogCleanup(ctx, q, 1, 10*time.Millisecond)

	deadline := time.Now().Add(300 * time.Millisecond)
	for atomic.LoadInt32(&execCount) == 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if atomic.LoadInt32(&execCount) == 0 {
		t.Fatalf("expected cleanup to execute at least once")
	}

	before := atomic.LoadInt32(&execCount)
	cancel()
	time.Sleep(40 * time.Millisecond)
	after := atomic.LoadInt32(&execCount)
	if after > before+1 {
		t.Fatalf("unexpected additional cleanup runs after cancel: before=%d after=%d", before, after)
	}
}

func TestStartActivityLogCleanup_DefaultIntervalBranch(t *testing.T) {
	var execCount int32

	fake := &cleanupFakeDBTX{execFn: func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
		atomic.AddInt32(&execCount, 1)
		return pgconn.NewCommandTag("DELETE 0"), nil
	}}

	q := db.New(fake)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	StartActivityLogCleanup(ctx, q, 1, 0)

	deadline := time.Now().Add(200 * time.Millisecond)
	for atomic.LoadInt32(&execCount) == 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if atomic.LoadInt32(&execCount) == 0 {
		t.Fatalf("expected initial cleanup run to execute even with default interval")
	}
}

func TestStartActivityLogCleanup_TickerRunsMoreThanOnce(t *testing.T) {
	var execCount int32

	fake := &cleanupFakeDBTX{execFn: func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
		atomic.AddInt32(&execCount, 1)
		return pgconn.NewCommandTag("DELETE 0"), nil
	}}

	q := db.New(fake)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	StartActivityLogCleanup(ctx, q, 1, 5*time.Millisecond)

	deadline := time.Now().Add(400 * time.Millisecond)
	for atomic.LoadInt32(&execCount) < 2 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if atomic.LoadInt32(&execCount) < 2 {
		t.Fatalf("expected cleanup ticker to run more than once, got %d", execCount)
	}
}

func TestStartActivityLogCleanup_DeleteErrorBranch(t *testing.T) {
	var execCount int32

	fake := &cleanupFakeDBTX{execFn: func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
		atomic.AddInt32(&execCount, 1)
		return pgconn.CommandTag{}, errors.New("delete failed")
	}}

	q := db.New(fake)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	StartActivityLogCleanup(ctx, q, 1, 10*time.Millisecond)

	deadline := time.Now().Add(250 * time.Millisecond)
	for atomic.LoadInt32(&execCount) == 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if atomic.LoadInt32(&execCount) == 0 {
		t.Fatalf("expected cleanup exec to be attempted")
	}
}
