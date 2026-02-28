package services

import (
	"bytes"
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestCASStorage_Save_ConcurrentSameContent(t *testing.T) {
	cas := NewCASStorage(t.TempDir())
	content := bytes.Repeat([]byte("concurrent-cas-test-"), 1024)
	const workers = 25
	results := make([]*SaveResult, workers)
	errs := make([]error, workers)

	var wg sync.WaitGroup
	wg.Add(workers)
	for i := 0; i < workers; i++ {
		go func(i int) {
			defer wg.Done()
			res, err := cas.Save(bytes.NewReader(content))
			results[i] = res
			errs[i] = err
		}(i)
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Fatalf("worker %d: Save returned error: %v", i, err)
		}
		if results[i] == nil {
			t.Fatalf("worker %d: Save returned nil result", i)
		}
		if results[i].Size != int64(len(content)) {
			t.Fatalf("worker %d: expected size %d, got %d", i, len(content), results[i].Size)
		}
	}

	hash := results[0].Hash
	for i := 1; i < workers; i++ {
		if results[i].Hash != hash {
			t.Fatalf("hash mismatch: results[0]=%s results[%d]=%s", hash, i, results[i].Hash)
		}
	}

	blobPath := cas.GetPath(hash)
	got, err := os.ReadFile(blobPath)
	if err != nil {
		t.Fatalf("failed to read blob %s: %v", blobPath, err)
	}
	if !bytes.Equal(got, content) {
		t.Fatalf("blob content mismatch: got=%d bytes want=%d bytes", len(got), len(content))
	}
}

func TestCASStorage_Exists_BeforeAndAfterSave(t *testing.T) {
	cas := NewCASStorage(t.TempDir())

	if cas.Exists("missing-hash") {
		t.Fatalf("expected missing hash to not exist")
	}

	res, err := cas.Save(bytes.NewReader([]byte("hello cas")))
	if err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if res == nil || res.Hash == "" {
		t.Fatalf("Save returned invalid result: %+v", res)
	}

	if !cas.Exists(res.Hash) {
		t.Fatalf("expected saved hash to exist: %s", res.Hash)
	}
}

func TestCASStorage_Save_PDFCompressionFallbackWhenGsMissing(t *testing.T) {
	t.Setenv("PATH", "")
	cas := NewCASStorage(t.TempDir())

	pdfLike := []byte("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF")
	res, err := cas.Save(bytes.NewReader(pdfLike))
	if err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if res == nil {
		t.Fatalf("Save returned nil result")
	}
	if res.MimeType != "application/pdf" {
		t.Fatalf("unexpected mime type: got=%q want=%q", res.MimeType, "application/pdf")
	}
	if res.Size != int64(len(pdfLike)) {
		t.Fatalf("unexpected size: got=%d want=%d", res.Size, len(pdfLike))
	}

	saved, err := os.ReadFile(cas.GetPath(res.Hash))
	if err != nil {
		t.Fatalf("failed to read saved blob: %v", err)
	}
	if !bytes.Equal(saved, pdfLike) {
		t.Fatalf("saved blob content mismatch")
	}
}

func TestCompressPDF_ReturnsErrorWhenGsUnavailable(t *testing.T) {
	t.Setenv("PATH", "")
	tmpDir := t.TempDir()
	input := tmpDir + "/in.pdf"
	if err := os.WriteFile(input, []byte("%PDF-1.4\n%%EOF"), 0644); err != nil {
		t.Fatalf("failed to write input pdf: %v", err)
	}

	if _, err := compressPDF(input); err == nil {
		t.Fatalf("expected compressPDF to fail when gs is unavailable")
	}
}

func TestCASStorage_Save_FailsWhenBasePathIsNotDirectory(t *testing.T) {
	baseFile := t.TempDir() + "/not-a-dir"
	if err := os.WriteFile(baseFile, []byte("x"), 0644); err != nil {
		t.Fatalf("failed to create base file: %v", err)
	}

	cas := NewCASStorage(baseFile)
	if _, err := cas.Save(bytes.NewReader([]byte("content"))); err == nil {
		t.Fatalf("expected Save to fail when base path is a file")
	}
}

func writeFakeGhostscript(t *testing.T, mode string) string {
	t.Helper()
	scriptDir := t.TempDir()
	gsPath := filepath.Join(scriptDir, "gs")
	script := "#!/bin/sh\n" +
		"out=\"\"\n" +
		"in=\"\"\n" +
		"for arg in \"$@\"; do\n" +
		"  case \"$arg\" in\n" +
		"    -sOutputFile=*) out=${arg#-sOutputFile=} ;;\n" +
		"    *) in=\"$arg\" ;;\n" +
		"  esac\n" +
		"done\n" +
		"case \"$GS_MODE\" in\n" +
		"  small) printf '%s' '%PDF-1.4\n%%EOF' > \"$out\" ; exit 0 ;;\n" +
		"  large) printf '%s' '%PDF-1.4\nXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX\n%%EOF' > \"$out\" ; exit 0 ;;\n" +
		"  dir) mkdir -p \"$out\" ; exit 0 ;;\n" +
		"  noout) exit 0 ;;\n" +
		"  *) exit 1 ;;\n" +
		"esac\n"
	if err := os.WriteFile(gsPath, []byte(script), 0755); err != nil {
		t.Fatalf("failed to create fake gs script: %v", err)
	}
	if runtime.GOOS == "windows" {
		t.Fatalf("test not supported on windows")
	}
	t.Setenv("PATH", scriptDir)
	t.Setenv("GS_MODE", mode)
	return gsPath
}

func TestCompressPDF_SuccessWithFakeGs(t *testing.T) {
	_ = writeFakeGhostscript(t, "small")
	input := filepath.Join(t.TempDir(), "in.pdf")
	if err := os.WriteFile(input, []byte("%PDF-1.4\noriginal-content\n%%EOF"), 0644); err != nil {
		t.Fatalf("failed to write input: %v", err)
	}

	out, err := compressPDF(input)
	if err != nil {
		t.Fatalf("compressPDF returned error: %v", err)
	}
	if out == "" {
		t.Fatalf("compressPDF returned empty output path")
	}
	if _, err := os.Stat(out); err != nil {
		t.Fatalf("expected compressed output to exist: %v", err)
	}
}

func TestCASStorage_Save_PDFUsesCompressedWhenSmaller(t *testing.T) {
	_ = writeFakeGhostscript(t, "small")
	cas := NewCASStorage(t.TempDir())
	pdfLike := bytes.Repeat([]byte("%PDF-1.4\nlong-pdf-content-line\n"), 200)

	res, err := cas.Save(bytes.NewReader(pdfLike))
	if err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if res == nil {
		t.Fatalf("Save returned nil result")
	}
	if res.MimeType != "application/pdf" {
		t.Fatalf("unexpected mime type: %q", res.MimeType)
	}
	if res.Size >= int64(len(pdfLike)) {
		t.Fatalf("expected compressed result to be smaller than original, got=%d orig=%d", res.Size, len(pdfLike))
	}
}

func TestCASStorage_Save_PDFKeepsOriginalWhenCompressedNotSmaller(t *testing.T) {
	_ = writeFakeGhostscript(t, "large")
	cas := NewCASStorage(t.TempDir())
	pdfLike := []byte("%PDF-1.4\nabc\n%%EOF")

	res, err := cas.Save(bytes.NewReader(pdfLike))
	if err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if res == nil {
		t.Fatalf("Save returned nil result")
	}
	if res.Size != int64(len(pdfLike)) {
		t.Fatalf("expected original size when compressed is not smaller: got=%d want=%d", res.Size, len(pdfLike))
	}
}

func TestCASStorage_Save_PDFKeepsOriginalWhenCompressedOutputMissing(t *testing.T) {
	_ = writeFakeGhostscript(t, "noout")
	cas := NewCASStorage(t.TempDir())
	pdfLike := []byte("%PDF-1.4\nabc\n%%EOF")

	res, err := cas.Save(bytes.NewReader(pdfLike))
	if err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if res == nil {
		t.Fatalf("Save returned nil result")
	}
	if res.Size != int64(len(pdfLike)) {
		t.Fatalf("expected original size when compressed output missing: got=%d want=%d", res.Size, len(pdfLike))
	}
}

func TestCASStorage_Save_ReturnsErrorWhenReadFinalFileFails(t *testing.T) {
	oldRead := casReadFile
	casReadFile = func(name string) ([]byte, error) {
		return nil, errors.New("read failed")
	}
	defer func() { casReadFile = oldRead }()

	cas := NewCASStorage(t.TempDir())
	pdfLike := []byte("content")

	if _, err := cas.Save(bytes.NewReader(pdfLike)); err == nil || !strings.Contains(err.Error(), "failed to read final file") {
		t.Fatalf("expected read final file error, got: %v", err)
	}
}

type errReader struct{}

func (errReader) Read(_ []byte) (int, error) {
	return 0, errors.New("read failure")
}

func TestCASStorage_Save_ReturnsErrorWhenCopyFails(t *testing.T) {
	cas := NewCASStorage(t.TempDir())

	if _, err := cas.Save(errReader{}); err == nil || !strings.Contains(err.Error(), "failed to write temp file") {
		t.Fatalf("expected write-temp-file error, got: %v", err)
	}
}

func TestCASStorage_Save_ReturnsErrorWhenCreateTempPutFails(t *testing.T) {
	baseDir := t.TempDir()
	cas := NewCASStorage(baseDir)

	oldCreateTemp := casCreateTemp
	casCreateTemp = func(dir, pattern string) (*os.File, error) {
		if strings.HasPrefix(pattern, "cas-put-") {
			return nil, errors.New("create temp put failed")
		}
		return oldCreateTemp(dir, pattern)
	}
	defer func() { casCreateTemp = oldCreateTemp }()

	content := bytes.Repeat([]byte("make-create-temp-put-fail-"), 4096)
	res, err := cas.Save(bytes.NewReader(content))

	if err == nil {
		t.Fatalf("expected error when creating temp put file, got result: %+v", res)
	}
	if !strings.Contains(err.Error(), "failed to create temp put file") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestCASStorage_Save_ReturnsErrorWhenOpenTempForSniffingFails(t *testing.T) {
	baseDir := t.TempDir()
	cas := NewCASStorage(baseDir)

	oldCreateTemp := casCreateTemp
	firstCall := true
	casCreateTemp = func(dir, pattern string) (*os.File, error) {
		f, err := oldCreateTemp(dir, pattern)
		if err != nil {
			return nil, err
		}
		if firstCall {
			firstCall = false
			_ = os.Remove(f.Name())
		}
		return f, nil
	}
	defer func() { casCreateTemp = oldCreateTemp }()

	res, err := cas.Save(bytes.NewReader(bytes.Repeat([]byte("x"), 2048)))

	if err == nil {
		t.Fatalf("expected error when opening temp file for sniffing, got result: %+v", res)
	}
	if !strings.Contains(err.Error(), "failed to open temp file for sniffing") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestCASStorage_Save_ReturnsErrorWhenCopyToTempPutFails(t *testing.T) {
	oldWrite := casWriteFile
	casWriteFile = func(f *os.File, blob []byte) (int, error) {
		return 0, errors.New("write failed")
	}
	defer func() { casWriteFile = oldWrite }()

	cas := NewCASStorage(t.TempDir())
	if _, err := cas.Save(bytes.NewReader([]byte("content"))); err == nil || !strings.Contains(err.Error(), "failed to copy to temp put file") {
		t.Fatalf("expected copy-to-temp-put error, got: %v", err)
	}
}

func TestCASStorage_Save_ReturnsErrorWhenPublishRenameFailsAndDestMissing(t *testing.T) {
	oldRename := casRename
	oldStat := casStat
	casRename = func(oldpath, newpath string) error {
		return errors.New("rename failed")
	}
	casStat = func(name string) (os.FileInfo, error) {
		return nil, os.ErrNotExist
	}
	defer func() {
		casRename = oldRename
		casStat = oldStat
	}()

	cas := NewCASStorage(t.TempDir())
	if _, err := cas.Save(bytes.NewReader([]byte("content"))); err == nil || !strings.Contains(err.Error(), "failed to publish cas blob") {
		t.Fatalf("expected publish error, got: %v", err)
	}
}

func TestCASStorage_Save_ReturnsSuccessWhenPublishRenameFailsButDestExists(t *testing.T) {
	baseDir := t.TempDir()
	cas := NewCASStorage(baseDir)

	content := []byte("force-rename-fail-but-dest-exists")
	hash := sha256Hex(content)
	destPath := filepath.Join(baseDir, hash)

	reader := bytes.NewReader(content)

	done := make(chan struct{})
	go func() {
		defer close(done)
		deadline := time.Now().Add(2 * time.Second)
		for time.Now().Before(deadline) {
			matches, _ := filepath.Glob(filepath.Join(baseDir, "cas-put-*-*"))
			if len(matches) > 0 {
				if err := os.Mkdir(destPath, 0755); err == nil {
					_ = os.Chmod(baseDir, 0555)
				}
				return
			}
			time.Sleep(2 * time.Millisecond)
		}
	}()

	res, err := cas.Save(reader)
	_ = os.Chmod(baseDir, 0755)
	<-done

	if err != nil {
		t.Fatalf("expected success when dest exists after rename failure, got: %v", err)
	}
	if res == nil || res.Hash != hash {
		t.Fatalf("unexpected result: %+v", res)
	}
}

func sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return fmt.Sprintf("%x", sum)
}
