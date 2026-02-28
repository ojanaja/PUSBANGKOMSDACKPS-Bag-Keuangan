FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache curl make jq git

# Download Go modules
COPY go.mod go.sum* ./
RUN if [ -f go.mod ]; then go mod download && go mod verify; fi

# Copy application source code
COPY . .

# Install tools required for code generation (sqlc, oapi-codegen)
RUN go install github.com/sqlc-dev/sqlc/cmd/sqlc@v1.26.0 && \
    go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.1

# Generate DB models and API stubs
RUN if [ -f sqlc.yaml ]; then sqlc generate; fi
RUN oapi-codegen -package handlers -generate types,server,spec openapi.yaml > internal/api/handlers/api.gen.go

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/api

# Final stage
FROM alpine:3.19

WORKDIR /app

# Install CA certificates for external API calls and tzdata for timezone
# Install Ghostscript for PDF compression
RUN apk add --no-cache ca-certificates tzdata ghostscript

# Copy the binary from the builder
COPY --from=builder /app/main .

# Expose port
EXPOSE 8080

# Command to run
CMD ["./main"]
