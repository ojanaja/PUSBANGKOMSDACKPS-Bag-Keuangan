package internal

import (
	"io"
	"os"

	pb "github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/storage-service/proto"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type StorageServer struct {
	pb.UnimplementedStorageServiceServer
	cas *CASStorage
}

func NewStorageServer(cas *CASStorage) *StorageServer {
	return &StorageServer{cas: cas}
}

func (s *StorageServer) UploadStream(stream pb.StorageService_UploadStreamServer) error {
	pr, pw := io.Pipe()

	errChan := make(chan error, 1)
	var result *SaveResult

	var filenameHint string
	hasStarted := false

	startSave := func() {
		if hasStarted {
			return
		}
		hasStarted = true
		go func() {
			res, err := s.cas.Save(pr, filenameHint)
			if err != nil {
				errChan <- err
				return
			}
			result = res
			errChan <- nil
		}()
	}

	for {
		req, err := stream.Recv()
		if err == io.EOF {
			startSave()
			pw.Close()
			break
		}
		if err != nil {
			pw.CloseWithError(err)
			return status.Errorf(codes.Unknown, "cannot receive stream request: %v", err)
		}

		switch payload := req.Request.(type) {
		case *pb.UploadRequest_FilenameHint:
			if !hasStarted {
				filenameHint = payload.FilenameHint
			}
		case *pb.UploadRequest_ChunkData:
			startSave()
			if _, err := pw.Write(payload.ChunkData); err != nil {
				return status.Errorf(codes.Internal, "failed to write to pipe: %v", err)
			}
		}
	}

	if !hasStarted {
		startSave()
	}

	if err := <-errChan; err != nil {
		return status.Errorf(codes.Internal, "failed to save file: %v", err)
	}

	return stream.SendAndClose(&pb.UploadResponse{
		Hash:     result.Hash,
		MimeType: result.MimeType,
		Size:     result.Size,
	})
}

func (s *StorageServer) DownloadStream(req *pb.DownloadRequest, stream pb.StorageService_DownloadStreamServer) error {
	filePath := s.cas.GetPath(req.Hash)
	file, err := os.Open(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return status.Errorf(codes.NotFound, "file not found: %v", err)
		}
		return status.Errorf(codes.Internal, "failed to open file: %v", err)
	}
	defer file.Close()

	buffer := make([]byte, 64*1024) // 64KB chunks
	for {
		n, err := file.Read(buffer)
		if err != nil {
			if err == io.EOF {
				break
			}
			return status.Errorf(codes.Internal, "failed to read file: %v", err)
		}

		if err := stream.Send(&pb.DownloadResponse{
			ChunkData: buffer[:n],
		}); err != nil {
			return status.Errorf(codes.Internal, "failed to send chunk: %v", err)
		}
	}

	return nil
}
