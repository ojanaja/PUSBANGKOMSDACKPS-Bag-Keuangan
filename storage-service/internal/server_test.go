package internal

import (
	"bytes"
	"context"
	"io"
	"net"
	"testing"

	pb "github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/storage-service/proto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"
)

const bufSize = 1024 * 1024

var lis *bufconn.Listener

func setupServer(t *testing.T) (*grpc.Server, *CASStorage) {
	lis = bufconn.Listen(bufSize)
	s := grpc.NewServer()

	tempDir := t.TempDir()
	cas := NewCASStorage(tempDir)
	pb.RegisterStorageServiceServer(s, NewStorageServer(cas))

	go func() {
		if err := s.Serve(lis); err != nil {
			// ignore normal close error in tests
		}
	}()

	return s, cas
}

func bufDialer(context.Context, string) (net.Conn, error) {
	return lis.Dial()
}

func TestUploadDownloadStream(t *testing.T) {
	s, cas := setupServer(t)
	defer s.Stop()

	conn, err := grpc.NewClient("passthrough://bufnet", grpc.WithContextDialer(bufDialer), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("Failed to dial bufnet: %v", err)
	}
	defer conn.Close()

	client := pb.NewStorageServiceClient(conn)

	// Create 10MB mock data
	mockData := bytes.Repeat([]byte("A"), 10*1024*1024)

	// Test Upload
	stream, err := client.UploadStream(context.Background())
	if err != nil {
		t.Fatalf("UploadStream failed: %v", err)
	}

	chunkSize := 64 * 1024
	for i := 0; i < len(mockData); i += chunkSize {
		end := i + chunkSize
		if end > len(mockData) {
			end = len(mockData)
		}

		err := stream.Send(&pb.UploadRequest{
			Request: &pb.UploadRequest_ChunkData{ChunkData: mockData[i:end]},
		})
		if err != nil {
			t.Fatalf("Send chunk failed: %v", err)
		}
	}

	resp, err := stream.CloseAndRecv()
	if err != nil {
		t.Fatalf("CloseAndRecv failed: %v", err)
	}

	if resp.Size != int64(len(mockData)) {
		t.Errorf("Expected size %d, got %d", len(mockData), resp.Size)
	}

	if resp.Hash == "" {
		t.Errorf("Expected hash, got empty string")
	}

	t.Logf("Uploaded file hash: %s", resp.Hash)

	if !cas.Exists(resp.Hash) {
		t.Errorf("Expected file to exist in CAS at path %s", cas.GetPath(resp.Hash))
	}

	// Test Download
	downStream, err := client.DownloadStream(context.Background(), &pb.DownloadRequest{Hash: resp.Hash})
	if err != nil {
		t.Fatalf("DownloadStream failed: %v", err)
	}

	var downloaded bytes.Buffer
	for {
		downResp, err := downStream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("Download stream recv failed: %v", err)
		}
		downloaded.Write(downResp.ChunkData)
	}

	if !bytes.Equal(mockData, downloaded.Bytes()) {
		t.Errorf("Downloaded data does not match mock data")
	}
}
