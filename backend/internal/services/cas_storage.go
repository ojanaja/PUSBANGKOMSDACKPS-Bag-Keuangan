package services

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
)

type CASStorage struct {
	BasePath string
}

func NewCASStorage(basePath string) *CASStorage {
	os.MkdirAll(basePath, 0755)
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

func (c *CASStorage) Save(r io.Reader) (*SaveResult, error) {
	tmp, err := os.CreateTemp(c.BasePath, "cas-upload-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmp.Name())

	_, err = io.Copy(tmp, r)
	if err != nil {
		tmp.Close()
		return nil, fmt.Errorf("failed to write temp file: %w", err)
	}
	tmp.Close()

	f, _ := os.Open(tmp.Name())
	header := make([]byte, 512)
	n, _ := f.Read(header)
	f.Close()
	mimeType := http.DetectContentType(header[:n])

	finalPath := tmp.Name()

	if mimeType == "application/pdf" {
		compressedPath, err := compressPDF(tmp.Name())
		if err == nil {
			infoOrig, _ := os.Stat(tmp.Name())
			infoComp, _ := os.Stat(compressedPath)

			if infoComp.Size() < infoOrig.Size() {
			} else {
			}
		} else {
			fmt.Printf("PDF compression failed: %v\n", err)
		}
	}

	fFinal, err := os.Open(finalPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open final file: %w", err)
	}
	defer fFinal.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, fFinal); err != nil {
		return nil, fmt.Errorf("failed to hash file: %w", err)
	}

	hashBytes := hasher.Sum(nil)
	hashHex := hex.EncodeToString(hashBytes)

	stat, _ := fFinal.Stat()
	finalSize := stat.Size()

	destPath := filepath.Join(c.BasePath, hashHex)
	if _, err := os.Stat(destPath); err == nil {
		return &SaveResult{Hash: hashHex, MimeType: mimeType, Size: finalSize}, nil
	}

	if _, err := fFinal.Seek(0, io.SeekStart); err != nil {
		return nil, fmt.Errorf("failed to seek file: %w", err)
	}

	destFile, err := os.Create(destPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create dest file: %w", err)
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, fFinal); err != nil {
		return nil, fmt.Errorf("failed to copy to dest: %w", err)
	}

	return &SaveResult{Hash: hashHex, MimeType: mimeType, Size: finalSize}, nil
}

/* ORIGINAL CODE PRESERVED FOR REFERENCE
func (c *CASStorage) Save(r io.Reader) (*SaveResult, error) {
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

	f, _ := os.Open(tmp.Name())
	buf := make([]byte, 512)
	n, _ := f.Read(buf)
	f.Close()
	mimeType := http.DetectContentType(buf[:n])

	destPath := filepath.Join(c.BasePath, hashHex)
	if _, err := os.Stat(destPath); err == nil {
		return &SaveResult{Hash: hashHex, MimeType: mimeType, Size: size}, nil
	}

	if err := os.Rename(tmp.Name(), destPath); err != nil {
		src, _ := os.Open(tmp.Name())
		dst, _ := os.Create(destPath)
		io.Copy(dst, src)
		src.Close()
		dst.Close()
	}

	return &SaveResult{Hash: hashHex, MimeType: mimeType, Size: size}, nil
}
*/

func (c *CASStorage) GetPath(hash string) string {
	return filepath.Join(c.BasePath, hash)
}

func (c *CASStorage) Exists(hash string) bool {
	_, err := os.Stat(c.GetPath(hash))
	return err == nil
}
