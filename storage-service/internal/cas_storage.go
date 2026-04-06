package internal

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
)

var (
	casCreateTemp = os.CreateTemp
	casReadFile   = os.ReadFile
	casStat       = os.Stat
	casRename     = os.Rename
	casWriteFile  = func(f *os.File, blob []byte) (int, error) { return f.Write(blob) }
)

type CASStorage struct {
	BasePath string
}

func NewCASStorage(basePath string) *CASStorage {
	_ = os.MkdirAll(basePath, 0755)
	return &CASStorage{BasePath: basePath}
}

type SaveResult struct {
	Hash     string
	MimeType string
	Size     int64
}

func compressPDF(inputPath string) (string, error) {
	outputPath := inputPath + ".compressed"
	cmd := exec.Command("gs",
		"-sDEVICE=pdfwrite",
		"-dCompatibilityLevel=1.4",
		"-dPDFSETTINGS=/ebook",
		"-dNOPAUSE",
		"-dQUIET",
		"-dBATCH",
		"-sOutputFile="+outputPath,
		inputPath,
	)

	if err := cmd.Run(); err != nil {
		return "", err
	}

	return outputPath, nil
}

func (c *CASStorage) Save(r io.Reader, filenameHint string) (*SaveResult, error) {
	tmp, err := casCreateTemp(c.BasePath, "cas-upload-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)

	if _, err = io.Copy(tmp, r); err != nil {
		return nil, fmt.Errorf("failed to write temp file: %w", err)
	}
	_ = tmp.Close()

	f, err := os.Open(tmpPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open temp file for sniffing: %w", err)
	}
	header := make([]byte, 512)
	n, _ := io.ReadFull(f, header)
	_ = f.Close()
	
	detectedMime := http.DetectContentType(header[:n])
	
	// Default to detected mime
	mimeType := detectedMime
	
	// If it's a generic zip/octet-stream, we try to grab the proper mime from the extension hint
	if (detectedMime == "application/zip" || detectedMime == "application/octet-stream") && filenameHint != "" {
		importMime := mime.TypeByExtension(filepath.Ext(filenameHint))
		if importMime != "" {
			mimeType = importMime
		}
	}

	finalPath := tmpPath

	// Only apply Ghostscript compression to actual PDFs
	if detectedMime == "application/pdf" {
		compressedPath, err := compressPDF(tmpPath)
		if err == nil {
			defer os.Remove(compressedPath)
			infoComp, errComp := os.Stat(compressedPath)
			infoOrig, errOrig := os.Stat(tmpPath)
			if errComp == nil && errOrig == nil && infoComp.Size() > 0 && infoComp.Size() < infoOrig.Size() {
				finalPath = compressedPath
			}
		} else {
			slog.Warn("PDF compression failed; using original", "error", err)
		}
	}

	blob, err := casReadFile(finalPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read final file: %w", err)
	}

	hashBytes := sha256.Sum256(blob)
	hashHex := hex.EncodeToString(hashBytes[:])
	finalSize := int64(len(blob))

	destPath := filepath.Join(c.BasePath, hashHex)
	if _, err := casStat(destPath); err == nil {
		return &SaveResult{Hash: hashHex, MimeType: mimeType, Size: finalSize}, nil
	}

	putTmp, err := casCreateTemp(c.BasePath, "cas-put-"+hashHex+"-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp put file: %w", err)
	}
	putTmpPath := putTmp.Name()
	defer os.Remove(putTmpPath)

	if _, err := casWriteFile(putTmp, blob); err != nil {
		return nil, fmt.Errorf("failed to copy to temp put file: %w", err)
	}
	_ = putTmp.Close()
	_ = os.Chmod(putTmpPath, 0644)

	if err := casRename(putTmpPath, destPath); err != nil {
		if _, statErr := casStat(destPath); statErr == nil {
			return &SaveResult{Hash: hashHex, MimeType: mimeType, Size: finalSize}, nil
		}
		return nil, fmt.Errorf("failed to publish cas blob: %w", err)
	}

	return &SaveResult{Hash: hashHex, MimeType: mimeType, Size: finalSize}, nil
}

func (c *CASStorage) GetPath(hash string) string {
	return filepath.Join(c.BasePath, hash)
}

func (c *CASStorage) Exists(hash string) bool {
	_, err := os.Stat(c.GetPath(hash))
	return err == nil
}
