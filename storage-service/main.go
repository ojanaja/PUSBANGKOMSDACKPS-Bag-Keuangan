package main

import (
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/storage-service/internal"
	pb "github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/storage-service/proto"
	"google.golang.org/grpc"
)

func main() {
	var basePath = os.Getenv("STORAGE_BASE_PATH")
	if basePath == "" {
		basePath = "./data"
	}
	
	err := os.MkdirAll(basePath, 0755)
	if err != nil {
		slog.Error("Failed to create base path", "error", err)
		os.Exit(1)
	}

	listener, err := net.Listen("tcp", ":50051")
	if err != nil {
		slog.Error("Failed to listen", "error", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer()
	
	casStorage := internal.NewCASStorage(basePath)
	storageServer := internal.NewStorageServer(casStorage)
	
	pb.RegisterStorageServiceServer(grpcServer, storageServer)

	slog.Info("Storage service listening", "address", ":50051", "basePath", basePath)

	go func() {
		if err := grpcServer.Serve(listener); err != nil {
			slog.Error("Failed to serve gRPC", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("Shutting down gRPC server...")
	grpcServer.GracefulStop()
	slog.Info("Server stopped")
}
