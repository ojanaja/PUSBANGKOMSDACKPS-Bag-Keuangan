package services

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

// CASStorage manages Content-Addressable Storage for documents.
type CASStorage struct {
	BasePath string // e.g., /app/storage/cas
}

// NewCASStorage creates a CAS storage handler.
func NewCASStorage(basePath string) *CASStorage {
	os.MkdirAll(basePath, 0755)
	return &CASStorage{BasePath: basePath}
}

// SaveResult holds the result of a CAS save operation.
type SaveResult struct {
	Hash     string
	MimeType string
	Size     int64
}

// Save hashes the file content with SHA-256 and stores it. If the hash already exists, returns the hash without writing.
func (c *CASStorage) Save(r io.Reader) (*SaveResult, error) {
	// Read into temp file to compute hash
	tmp, err := os.CreateTemp(c.BasePath, "cas-upload-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmp.Name())

	hasher := sha256.New()
	tee := io.TeeReader(r, hasher)

	size, err := io.Copy(tmp, tee)
	if err != nil {
		tmp.Close()
		return nil, fmt.Errorf("failed to write temp file: %w", err)
	}
	tmp.Close()

	hashBytes := hasher.Sum(nil)
	hashHex := hex.EncodeToString(hashBytes)

	// Detect MIME type from first 512 bytes
	f, _ := os.Open(tmp.Name())
	buf := make([]byte, 512)
	n, _ := f.Read(buf)
	f.Close()
	mimeType := http.DetectContentType(buf[:n])

	// Check if file already exists
	destPath := filepath.Join(c.BasePath, hashHex)
	if _, err := os.Stat(destPath); err == nil {
		// Already exists — deduplication
		return &SaveResult{Hash: hashHex, MimeType: mimeType, Size: size}, nil
	}

	// Move temp file to final destination
	if err := os.Rename(tmp.Name(), destPath); err != nil {
		// Fallback: copy if rename fails (cross-device)
		src, _ := os.Open(tmp.Name())
		dst, _ := os.Create(destPath)
		io.Copy(dst, src)
		src.Close()
		dst.Close()
	}

	return &SaveResult{Hash: hashHex, MimeType: mimeType, Size: size}, nil
}

// GetPath returns the full path for a given hash.
func (c *CASStorage) GetPath(hash string) string {
	return filepath.Join(c.BasePath, hash)
}

// Exists checks whether a file with the given hash exists.
func (c *CASStorage) Exists(hash string) bool {
	_, err := os.Stat(c.GetPath(hash))
	return err == nil
}
