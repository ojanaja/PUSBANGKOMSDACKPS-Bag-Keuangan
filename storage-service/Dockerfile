# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o storage-server main.go

# Run stage
FROM alpine:latest
RUN apk add --no-cache ghostscript
WORKDIR /app
COPY --from=builder /app/storage-server .

EXPOSE 50051

ENV STORAGE_BASE_PATH=/app/data

CMD ["./storage-server"]
