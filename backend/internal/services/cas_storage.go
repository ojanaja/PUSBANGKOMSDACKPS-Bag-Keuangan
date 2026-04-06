package services

import (
	"context"
	"io"

	pb "github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/storage-service/proto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type CASStorage struct {
	client pb.StorageServiceClient
}

func NewCASStorage(conn grpc.ClientConnInterface) *CASStorage {
	return &CASStorage{
		client: pb.NewStorageServiceClient(conn),
	}
}

type SaveResult struct {
	Hash     string
	MimeType string
	Size     int64
}

func (c *CASStorage) Save(r io.Reader, filenameHint string) (*SaveResult, error) {
	stream, err := c.client.UploadStream(context.Background())
	if err != nil {
		return nil, err
	}

	if filenameHint != "" {
		if sendErr := stream.Send(&pb.UploadRequest{
			Request: &pb.UploadRequest_FilenameHint{FilenameHint: filenameHint},
		}); sendErr != nil {
			return nil, sendErr
		}
	}

	buf := make([]byte, 64*1024) // 64KB
	for {
		n, err := r.Read(buf)
		if n > 0 {
			if sendErr := stream.Send(&pb.UploadRequest{
				Request: &pb.UploadRequest_ChunkData{ChunkData: buf[:n]},
			}); sendErr != nil {
				return nil, sendErr
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
	}

	resp, err := stream.CloseAndRecv()
	if err != nil {
		return nil, err
	}

	return &SaveResult{
		Hash:     resp.Hash,
		MimeType: resp.MimeType,
		Size:     resp.Size,
	}, nil
}

// Download streams the file from gRPC to the writer.
// If the file exists, it will call onFound() before writing any data.
func (c *CASStorage) Download(hash string, w io.Writer, onFound func()) error {
	stream, err := c.client.DownloadStream(context.Background(), &pb.DownloadRequest{Hash: hash})
	if err != nil {
		return err
	}

	// Try reading the first chunk to ensure it doesn't return NotFound
	resp, err := stream.Recv()
	if err != nil {
		if err == io.EOF {
			// Found, but empty
			onFound()
			return nil
		}
		return err
	}

	onFound()
	if _, err := w.Write(resp.ChunkData); err != nil {
		return err
	}

	for {
		resp, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if _, err := w.Write(resp.ChunkData); err != nil {
			return err
		}
	}
	return nil
}

func (c *CASStorage) IsNotFoundError(err error) bool {
	if st, ok := status.FromError(err); ok {
		return st.Code() == codes.NotFound
	}
	return false
}
