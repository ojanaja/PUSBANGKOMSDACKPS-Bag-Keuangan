package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

type fakeReadyPool struct {
	pingErr error
}

func (f *fakeReadyPool) Begin(ctx context.Context) (pgx.Tx, error) {
	return nil, errors.New("not implemented")
}

func (f *fakeReadyPool) Ping(ctx context.Context) error {
	return f.pingErr
}

func TestHealthHandlers(t *testing.T) {
	e := echo.New()

	t.Run("GetHealthz", func(t *testing.T) {
		h := &Handler{}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/healthz", nil), rec)

		if err := h.GetHealthz(ctx); err != nil {
			t.Fatalf("GetHealthz returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "UP") {
			t.Fatalf("unexpected payload: %s", rec.Body.String())
		}
	})

	t.Run("GetReadyz up", func(t *testing.T) {
		h := &Handler{pool: &fakeReadyPool{}}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/readyz", nil), rec)

		if err := h.GetReadyz(ctx); err != nil {
			t.Fatalf("GetReadyz returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("GetReadyz down", func(t *testing.T) {
		h := &Handler{pool: &fakeReadyPool{pingErr: errors.New("db down")}}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/readyz", nil), rec)

		if err := h.GetReadyz(ctx); err != nil {
			t.Fatalf("GetReadyz returned error: %v", err)
		}
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})
}

