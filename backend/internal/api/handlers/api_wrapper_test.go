package handlers

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

type wrapperTestServer struct{}

func (s *wrapperTestServer) CreateAnggaranSnapshot(ctx echo.Context) error {
	return ctx.NoContent(http.StatusNoContent)
}
func (s *wrapperTestServer) UpdateLockPagu(ctx echo.Context, id openapi_types.UUID) error {
	return ctx.NoContent(http.StatusNoContent)
}
func (s *wrapperTestServer) ImportAnggaranData(ctx echo.Context) error {
	return ctx.NoContent(http.StatusNoContent)
}
func (s *wrapperTestServer) GetAnggaranTree(ctx echo.Context, params GetAnggaranTreeParams) error {
	return ctx.NoContent(http.StatusNoContent)
}
func (s *wrapperTestServer) GetAnggaranSnapshots(ctx echo.Context, params GetAnggaranSnapshotsParams) error {
	return ctx.NoContent(http.StatusNoContent)
}
func (s *wrapperTestServer) UploadBuktiAnggaran(ctx echo.Context) error {
	return ctx.NoContent(http.StatusNoContent)
}
func (s *wrapperTestServer) UpdateAnggaranNode(ctx echo.Context, id openapi_types.UUID) error {
	return ctx.NoContent(http.StatusNoContent)
}
func (s *wrapperTestServer) GetAnggaranDokumenByNode(ctx echo.Context, id openapi_types.UUID) error {
	return ctx.NoContent(http.StatusNoContent)
}
func (s *wrapperTestServer) DownloadDocument(ctx echo.Context, id openapi_types.UUID) error {
	return ctx.NoContent(http.StatusNoContent)
}
func (s *wrapperTestServer) GetHealthz(ctx echo.Context) error {
	return ctx.NoContent(http.StatusNoContent)
}
func (s *wrapperTestServer) GetReadyz(ctx echo.Context) error {
	return ctx.NoContent(http.StatusNoContent)
}
func (s *wrapperTestServer) ListUsers(ctx echo.Context) error {
	return ctx.NoContent(http.StatusNoContent)
}
func (s *wrapperTestServer) CreateUser(ctx echo.Context) error {
	return ctx.NoContent(http.StatusNoContent)
}
func (s *wrapperTestServer) DeleteUser(ctx echo.Context, id openapi_types.UUID) error {
	return ctx.NoContent(http.StatusNoContent)
}
func (s *wrapperTestServer) UpdateUser(ctx echo.Context, id openapi_types.UUID) error {
	return ctx.NoContent(http.StatusNoContent)
}

func TestGeneratedWrapper_RoutesAndParams(t *testing.T) {
	e := echo.New()
	RegisterHandlers(e, &wrapperTestServer{})

	validID := "11111111-1111-1111-1111-111111111111"
	tests := []struct {
		method string
		path   string
		want   int
	}{
		{method: http.MethodPost, path: "/anggaran/import", want: http.StatusNoContent},
		{method: http.MethodGet, path: "/anggaran/tree?tahun=2026", want: http.StatusNoContent},
		{method: http.MethodPost, path: "/anggaran/upload-bukti", want: http.StatusNoContent},
		{method: http.MethodPut, path: "/anggaran/" + validID, want: http.StatusNoContent},
		{method: http.MethodGet, path: "/anggaran/" + validID + "/documents", want: http.StatusNoContent},
		{method: http.MethodGet, path: "/documents/" + validID, want: http.StatusNoContent},
		{method: http.MethodGet, path: "/healthz", want: http.StatusNoContent},
		{method: http.MethodGet, path: "/readyz", want: http.StatusNoContent},
		{method: http.MethodGet, path: "/users", want: http.StatusNoContent},
		{method: http.MethodPost, path: "/users", want: http.StatusNoContent},
		{method: http.MethodDelete, path: "/users/" + validID, want: http.StatusNoContent},
		{method: http.MethodPut, path: "/users/" + validID, want: http.StatusNoContent},
	}

	for _, tc := range tests {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		if rec.Code != tc.want {
			t.Fatalf("%s %s: unexpected status got=%d want=%d body=%s", tc.method, tc.path, rec.Code, tc.want, rec.Body.String())
		}
	}
}

func TestGeneratedWrapper_InvalidUUIDPathReturnsBadRequest(t *testing.T) {
	e := echo.New()
	RegisterHandlers(e, &wrapperTestServer{})

	req := httptest.NewRequest(http.MethodGet, "/documents/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("unexpected status got=%d want=%d", rec.Code, http.StatusBadRequest)
	}
}

func TestGeneratedWrapper_InvalidQueryAndRequiredParams(t *testing.T) {
	e := echo.New()
	RegisterHandlers(e, &wrapperTestServer{})

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{name: "anggaran tree missing required tahun", method: http.MethodGet, path: "/anggaran/tree"},
		{name: "anggaran tree invalid tahun", method: http.MethodGet, path: "/anggaran/tree?tahun=bad"},
	}

	for _, tc := range tests {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s: unexpected status got=%d want=%d body=%s", tc.name, rec.Code, http.StatusBadRequest, rec.Body.String())
		}
	}
}

func TestGeneratedWrapper_InvalidUUIDForAllPathRoutes(t *testing.T) {
	e := echo.New()
	RegisterHandlers(e, &wrapperTestServer{})

	tests := []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/anggaran/not-a-uuid/documents"},
		{method: http.MethodPut, path: "/anggaran/not-a-uuid"},
		{method: http.MethodGet, path: "/documents/not-a-uuid"},
		{method: http.MethodDelete, path: "/users/not-a-uuid"},
		{method: http.MethodPut, path: "/users/not-a-uuid"},
	}

	for _, tc := range tests {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s %s: unexpected status got=%d want=%d body=%s", tc.method, tc.path, rec.Code, http.StatusBadRequest, rec.Body.String())
		}
	}
}

func TestDecodeSpec_ErrorBranches_FromWrapperSuite(t *testing.T) {
	original := swaggerSpec
	t.Cleanup(func() {
		swaggerSpec = original
	})

	t.Run("invalid base64", func(t *testing.T) {
		swaggerSpec = []string{"%%%"}
		_, err := decodeSpec()
		if err == nil {
			t.Fatalf("expected base64 decode error")
		}
	})

	t.Run("invalid gzip data", func(t *testing.T) {
		swaggerSpec = []string{base64.StdEncoding.EncodeToString([]byte("not-gzip"))}
		_, err := decodeSpec()
		if err == nil {
			t.Fatalf("expected gzip reader error")
		}
	})
}
