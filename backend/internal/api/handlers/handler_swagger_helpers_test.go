package handlers

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"errors"
	"testing"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/db"
	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/services"
)

func TestNewHandler_AssignsDependencies(t *testing.T) {
	queries := &db.Queries{}
	cas := &services.CASStorage{}
	auth := &services.AuthService{}
	activity := &services.ActivityLogger{}

	h := NewHandler(queries, nil, cas, auth, activity)
	if h == nil {
		t.Fatalf("NewHandler returned nil")
	}
	if h.queries != queries {
		t.Fatalf("queries not assigned")
	}
	if h.cas != cas {
		t.Fatalf("cas not assigned")
	}
	if h.auth != auth {
		t.Fatalf("auth not assigned")
	}
	if h.activity != activity {
		t.Fatalf("activity not assigned")
	}
}

func TestNewAuthHandler_AssignsDependencies(t *testing.T) {
	authSvc := &services.AuthService{}
	queries := &db.Queries{}
	activity := &services.ActivityLogger{}

	h := NewAuthHandler(authSvc, queries, nil, activity)
	if h == nil {
		t.Fatalf("NewAuthHandler returned nil")
	}
	if h.authService != authSvc {
		t.Fatalf("authService not assigned")
	}
	if h.queries != queries {
		t.Fatalf("queries not assigned")
	}
	if h.activity != activity {
		t.Fatalf("activity not assigned")
	}
}

func TestNumericToFloat32Ptr_CoversHelper(t *testing.T) {
	n, err := decimalStringToNumeric("12.5")
	if err != nil {
		t.Fatalf("decimalStringToNumeric returned error: %v", err)
	}
	got := numericToFloat32Ptr(n)
	if got == nil {
		t.Fatalf("numericToFloat32Ptr returned nil")
	}
	if *got != float32(12.5) {
		t.Fatalf("unexpected conversion: got=%v want=%v", *got, float32(12.5))
	}
}

func TestPathToRawSpec_AndGetSwagger(t *testing.T) {
	if m := PathToRawSpec(""); len(m) != 0 {
		t.Fatalf("expected empty map for empty path")
	}

	withPath := PathToRawSpec("openapi.yaml")
	if len(withPath) != 1 {
		t.Fatalf("expected one entry for non-empty path, got=%d", len(withPath))
	}
	getRaw, ok := withPath["openapi.yaml"]
	if !ok {
		t.Fatalf("expected key openapi.yaml")
	}
	raw, err := getRaw()
	if err != nil {
		t.Fatalf("raw spec retrieval returned error: %v", err)
	}
	if len(raw) == 0 {
		t.Fatalf("raw spec is empty")
	}

	swagger, err := GetSwagger()
	if err != nil {
		t.Fatalf("GetSwagger returned error: %v", err)
	}
	if swagger == nil {
		t.Fatalf("GetSwagger returned nil spec")
	}
}

func TestDecodeSpec_ErrorBranches(t *testing.T) {
	orig := swaggerSpec
	t.Cleanup(func() { swaggerSpec = orig })

	swaggerSpec = []string{"%%%"}
	if _, err := decodeSpec(); err == nil {
		t.Fatalf("expected base64 decode error")
	}

	swaggerSpec = []string{"bm90LWd6aXAtZGF0YQ=="}
	if _, err := decodeSpec(); err == nil {
		t.Fatalf("expected gzip decode error")
	}

	var gz bytes.Buffer
	zw := gzip.NewWriter(&gz)
	_, _ = zw.Write([]byte("hello-openapi"))
	_ = zw.Close()
	truncated := gz.Bytes()[:len(gz.Bytes())-2]
	swaggerSpec = []string{base64.StdEncoding.EncodeToString(truncated)}
	if _, err := decodeSpec(); err == nil {
		t.Fatalf("expected gzip read error for truncated stream")
	}
}

func TestGetSwagger_ErrorBranches(t *testing.T) {
	orig := rawSpec
	t.Cleanup(func() { rawSpec = orig })

	rawSpec = func() ([]byte, error) {
		return nil, errors.New("raw spec unavailable")
	}
	if _, err := GetSwagger(); err == nil {
		t.Fatalf("expected error when rawSpec fails")
	}

	rawSpec = func() ([]byte, error) {
		return []byte("not-openapi"), nil
	}
	if _, err := GetSwagger(); err == nil {
		t.Fatalf("expected parser error for invalid spec data")
	}
}
