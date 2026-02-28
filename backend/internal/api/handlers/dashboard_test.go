package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	"github.com/xuri/excelize/v2"
)

type fakeRows struct {
	idx  int
	data [][]any
	err  error
}

func (r *fakeRows) Close()                                       {}
func (r *fakeRows) Err() error                                   { return r.err }
func (r *fakeRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (r *fakeRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (r *fakeRows) Next() bool {
	if r.idx >= len(r.data) {
		return false
	}
	r.idx++
	return true
}
func (r *fakeRows) Scan(dest ...any) error {
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
func (r *fakeRows) Values() ([]any, error) {
	if r.idx == 0 || r.idx > len(r.data) {
		return nil, errors.New("values called without current row")
	}
	return r.data[r.idx-1], nil
}
func (r *fakeRows) RawValues() [][]byte { return nil }
func (r *fakeRows) Conn() *pgx.Conn     { return nil }

type fakeDBTX struct {
	queryFn func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
}

func (f *fakeDBTX) Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, errors.New("not implemented")
}

func (f *fakeDBTX) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	if f.queryFn == nil {
		return nil, errors.New("queryFn not set")
	}
	return f.queryFn(ctx, sql, args...)
}

func (f *fakeDBTX) QueryRow(context.Context, string, ...interface{}) pgx.Row {
	return nil
}

func TestDashboardHandlers_ChartDrilldownNotificationsAndEWS(t *testing.T) {
	paketID1 := uuid.New()
	paketID2 := uuid.New()

	mockDB := &fakeDBTX{
		queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			switch {
			case strings.Contains(sql, "-- name: GetDashboardChart :many"):
				return &fakeRows{data: [][]any{
					{int32(1), float64ToNumeric(100), float64ToNumeric(20), float64ToNumeric(10), float64ToNumeric(15), float64ToNumeric(12)},
				}}, nil
			case strings.Contains(sql, "-- name: GetDashboardDrillDown :many"):
				docs := []byte(`[{"kategori":"FISIK","jenis_dokumen":"FOTO","original_name":"bukti.jpg","file_size_bytes":123}]`)
				return &fakeRows{data: [][]any{
					{pgtype.UUID{Bytes: paketID1, Valid: true}, "Paket A", float64ToNumeric(1000), float64ToNumeric(100), float64ToNumeric(10), docs},
				}}, nil
			case strings.Contains(sql, "-- name: GetComplianceMatrix :many"):
				return &fakeRows{data: [][]any{
					{pgtype.UUID{Bytes: paketID1, Valid: true}, "Paket Kritis", float64ToNumeric(100), float64ToNumeric(100), float64ToNumeric(50), float64ToNumeric(0)},
					{pgtype.UUID{Bytes: paketID2, Valid: true}, "Paket Warning", float64ToNumeric(100), float64ToNumeric(100), float64ToNumeric(100), float64ToNumeric(70)},
				}}, nil
			default:
				return nil, errors.New("unexpected query")
			}
		},
	}

	h := &Handler{queries: db.New(mockDB)}
	e := echo.New()

	t.Run("GetDashboardChart", func(t *testing.T) {
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/chart", nil), rec)

		err := h.GetDashboardChart(ctx, GetDashboardChartParams{})
		if err != nil {
			t.Fatalf("GetDashboardChart returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: got=%d", rec.Code)
		}

		var got []DashboardChartItem
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(got) != 1 || got[0].Bulan == nil || *got[0].Bulan != 1 {
			t.Fatalf("unexpected chart payload: %+v", got)
		}
	})

	t.Run("GetDashboardDrilldown", func(t *testing.T) {
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/drilldown", nil), rec)

		err := h.GetDashboardDrilldown(ctx, GetDashboardDrilldownParams{Bulan: 1})
		if err != nil {
			t.Fatalf("GetDashboardDrilldown returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: got=%d", rec.Code)
		}

		var got []DashboardDrilldownItem
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(got) != 1 || got[0].NamaPaket == nil || *got[0].NamaPaket != "Paket A" {
			t.Fatalf("unexpected drilldown payload: %+v", got)
		}
		if got[0].Dokumen == nil || len(*got[0].Dokumen) != 1 {
			t.Fatalf("expected one document metadata entry")
		}
	})

	t.Run("GetDashboardNotifications", func(t *testing.T) {
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/notifications", nil), rec)

		err := h.GetDashboardNotifications(ctx)
		if err != nil {
			t.Fatalf("GetDashboardNotifications returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: got=%d", rec.Code)
		}

		var got []NotificationItem
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(got) != 2 {
			t.Fatalf("expected 2 notifications, got %d", len(got))
		}
	})

	t.Run("GetDashboardEWS", func(t *testing.T) {
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/ews", nil), rec)

		err := h.GetDashboardEWS(ctx, GetDashboardEWSParams{})
		if err != nil {
			t.Fatalf("GetDashboardEWS returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: got=%d", rec.Code)
		}

		var got []DashboardEWSItem
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(got) != 2 {
			t.Fatalf("expected 2 EWS items, got %d", len(got))
		}
	})
}

func TestExportPaketExcel_Success(t *testing.T) {
	paketID := uuid.New()
	call := 0

	mockDB := &fakeDBTX{
		queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			if !strings.Contains(sql, "-- name: GetComplianceMatrixPaged :many") {
				return nil, errors.New("unexpected query")
			}
			call++
			if call == 1 {
				return &fakeRows{data: [][]any{
					{pgtype.UUID{Bytes: paketID, Valid: true}, "Paket Export", float64ToNumeric(1000), float64ToNumeric(1000), float64ToNumeric(500), float64ToNumeric(45)},
					{pgtype.UUID{Bytes: uuid.New(), Valid: true}, "Paket Kritis", float64ToNumeric(1000), float64ToNumeric(1000), float64ToNumeric(100), float64ToNumeric(0)},
					{pgtype.UUID{Bytes: uuid.New(), Valid: true}, "Paket Lengkap", float64ToNumeric(1000), float64ToNumeric(1000), float64ToNumeric(100), float64ToNumeric(100)},
				}}, nil
			}
			return &fakeRows{data: [][]any{}}, nil
		},
	}

	h := &Handler{queries: db.New(mockDB)}
	e := echo.New()
	rec := httptest.NewRecorder()
	ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/export", nil), rec)

	err := h.ExportPaketExcel(ctx, ExportPaketExcelParams{})
	if err != nil {
		t.Fatalf("ExportPaketExcel returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: got=%d", rec.Code)
	}
	if !strings.Contains(rec.Header().Get(echo.HeaderContentType), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
		t.Fatalf("unexpected content type: %q", rec.Header().Get(echo.HeaderContentType))
	}
	if rec.Body.Len() == 0 {
		t.Fatalf("expected non-empty excel output body")
	}
}

func TestDashboardHandlers_ErrorPaths(t *testing.T) {
	e := echo.New()

	t.Run("GetDashboardChart db error", func(t *testing.T) {
		h := &Handler{queries: db.New(&fakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			return nil, errors.New("db error")
		}})}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/chart", nil), rec)

		if err := h.GetDashboardChart(ctx, GetDashboardChartParams{}); err != nil {
			t.Fatalf("GetDashboardChart returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("GetDashboardDrilldown db error", func(t *testing.T) {
		h := &Handler{queries: db.New(&fakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			return nil, errors.New("db error")
		}})}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/drilldown", nil), rec)

		if err := h.GetDashboardDrilldown(ctx, GetDashboardDrilldownParams{Bulan: 1}); err != nil {
			t.Fatalf("GetDashboardDrilldown returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("GetDashboardNotifications db error", func(t *testing.T) {
		h := &Handler{queries: db.New(&fakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			return nil, errors.New("db error")
		}})}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/notifications", nil), rec)

		if err := h.GetDashboardNotifications(ctx); err != nil {
			t.Fatalf("GetDashboardNotifications returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("GetDashboardEWS db error", func(t *testing.T) {
		h := &Handler{queries: db.New(&fakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			return nil, errors.New("db error")
		}})}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/ews", nil), rec)

		if err := h.GetDashboardEWS(ctx, GetDashboardEWSParams{}); err != nil {
			t.Fatalf("GetDashboardEWS returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("ExportPaketExcel db error", func(t *testing.T) {
		h := &Handler{queries: db.New(&fakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			if strings.Contains(sql, "-- name: GetComplianceMatrixPaged :many") {
				return nil, errors.New("db error")
			}
			return nil, errors.New("unexpected query")
		}})}
		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/export", nil), rec)

		if err := h.ExportPaketExcel(ctx, ExportPaketExcelParams{}); err != nil {
			t.Fatalf("ExportPaketExcel returned error: %v", err)
		}
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})
}

func TestDashboardHandlers_TahunParamsAndExportWarningBranch(t *testing.T) {
	e := echo.New()
	tahun := 2027

	t.Run("tahun params for chart drilldown and ews", func(t *testing.T) {
		h := &Handler{queries: db.New(&fakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			switch {
			case strings.Contains(sql, "-- name: GetDashboardChart :many"):
				if len(args) != 1 || args[0] != int32(tahun) {
					return nil, errors.New("unexpected chart tahun")
				}
				return &fakeRows{data: [][]any{}}, nil
			case strings.Contains(sql, "-- name: GetDashboardDrillDown :many"):
				if len(args) != 2 || args[1] != int32(tahun) {
					return nil, errors.New("unexpected drilldown tahun")
				}
				return &fakeRows{data: [][]any{}}, nil
			case strings.Contains(sql, "-- name: GetComplianceMatrix :many"):
				if len(args) != 1 || args[0] != int32(tahun) {
					return nil, errors.New("unexpected ews tahun")
				}
				return &fakeRows{data: [][]any{}}, nil
			default:
				return nil, errors.New("unexpected query")
			}
		}})}

		rec1 := httptest.NewRecorder()
		ctx1 := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/chart", nil), rec1)
		if err := h.GetDashboardChart(ctx1, GetDashboardChartParams{Tahun: &tahun}); err != nil {
			t.Fatalf("GetDashboardChart returned error: %v", err)
		}

		rec2 := httptest.NewRecorder()
		ctx2 := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/drilldown", nil), rec2)
		if err := h.GetDashboardDrilldown(ctx2, GetDashboardDrilldownParams{Bulan: 1, Tahun: &tahun}); err != nil {
			t.Fatalf("GetDashboardDrilldown returned error: %v", err)
		}

		rec3 := httptest.NewRecorder()
		ctx3 := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/ews", nil), rec3)
		if err := h.GetDashboardEWS(ctx3, GetDashboardEWSParams{Tahun: &tahun}); err != nil {
			t.Fatalf("GetDashboardEWS returned error: %v", err)
		}

		if rec1.Code != http.StatusOK || rec2.Code != http.StatusOK || rec3.Code != http.StatusOK {
			t.Fatalf("expected all dashboard handlers to return 200, got chart=%d drilldown=%d ews=%d", rec1.Code, rec2.Code, rec3.Code)
		}
	})

	t.Run("export warning status branch and tahun param", func(t *testing.T) {
		calls := 0
		h := &Handler{queries: db.New(&fakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			if !strings.Contains(sql, "-- name: GetComplianceMatrixPaged :many") {
				return nil, errors.New("unexpected query")
			}
			if len(args) != 3 || args[0] != int32(tahun) {
				return nil, errors.New("unexpected export tahun")
			}
			calls++
			if calls == 1 {
				return &fakeRows{data: [][]any{{
					pgtype.UUID{Bytes: uuid.New(), Valid: true}, "Paket Warning", float64ToNumeric(1000), float64ToNumeric(1000), float64ToNumeric(100), float64ToNumeric(5),
				}}}, nil
			}
			return &fakeRows{data: [][]any{}}, nil
		}})}

		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/export", nil), rec)
		if err := h.ExportPaketExcel(ctx, ExportPaketExcelParams{Tahun: &tahun}); err != nil {
			t.Fatalf("ExportPaketExcel returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
		if rec.Body.Len() == 0 {
			t.Fatalf("expected non-empty export body")
		}
	})

	t.Run("export immediate empty set", func(t *testing.T) {
		h := &Handler{queries: db.New(&fakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			if !strings.Contains(sql, "-- name: GetComplianceMatrixPaged :many") {
				return nil, errors.New("unexpected query")
			}
			return &fakeRows{data: [][]any{}}, nil
		}})}

		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/export", nil), rec)
		if err := h.ExportPaketExcel(ctx, ExportPaketExcelParams{}); err != nil {
			t.Fatalf("ExportPaketExcel returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("export close error branch", func(t *testing.T) {
		oldClose := closeExcelFile
		closeExcelFile = func(f *excelize.File) error {
			return errors.New("close failed")
		}
		defer func() { closeExcelFile = oldClose }()

		h := &Handler{queries: db.New(&fakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
			if !strings.Contains(sql, "-- name: GetComplianceMatrixPaged :many") {
				return nil, errors.New("unexpected query")
			}
			return &fakeRows{data: [][]any{}}, nil
		}})}

		rec := httptest.NewRecorder()
		ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/export", nil), rec)
		if err := h.ExportPaketExcel(ctx, ExportPaketExcelParams{}); err != nil {
			t.Fatalf("ExportPaketExcel returned error: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})
}

func TestGetDashboardDrilldown_MalformedDocsStillSuccess(t *testing.T) {
	e := echo.New()
	paketID := uuid.New()

	h := &Handler{queries: db.New(&fakeDBTX{queryFn: func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
		if strings.Contains(sql, "-- name: GetDashboardDrillDown :many") {
			return &fakeRows{data: [][]any{{
				pgtype.UUID{Bytes: paketID, Valid: true},
				"Paket A",
				float64ToNumeric(1000),
				float64ToNumeric(100),
				float64ToNumeric(10),
				[]byte("{bad-json"),
			}}}, nil
		}
		return nil, errors.New("unexpected query")
	}})}

	rec := httptest.NewRecorder()
	ctx := e.NewContext(httptest.NewRequest(http.MethodGet, "/dashboard/drilldown", nil), rec)

	if err := h.GetDashboardDrilldown(ctx, GetDashboardDrilldownParams{Bulan: 1}); err != nil {
		t.Fatalf("GetDashboardDrilldown returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", rec.Code)
	}
}
