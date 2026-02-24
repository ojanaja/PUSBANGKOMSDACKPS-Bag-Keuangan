package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/vandal/keuangan-pusbangkom/internal/api/handlers"
	"github.com/vandal/keuangan-pusbangkom/internal/db"
	"github.com/vandal/keuangan-pusbangkom/internal/services"
)

// RouterImpl implements the generated ServerInterface.
type RouterImpl struct {
	queries *db.Queries
	pool    *pgxpool.Pool
	cas     *services.CASStorage
}

// Ensure RouterImpl implements handlers.ServerInterface
var _ handlers.ServerInterface = (*RouterImpl)(nil)

// ──── Health Checks ────────────────────────────────────

func (r *RouterImpl) GetHealthz(ctx echo.Context) error {
	return ctx.JSON(http.StatusOK, map[string]string{"status": "UP"})
}

func (r *RouterImpl) GetReadyz(ctx echo.Context) error {
	if err := r.pool.Ping(ctx.Request().Context()); err != nil {
		slog.Error("Database ping failed", "error", err)
		return ctx.JSON(http.StatusServiceUnavailable, map[string]string{"status": "DOWN", "error": "db disconnected"})
	}
	return ctx.JSON(http.StatusOK, map[string]string{"status": "UP"})
}

// ──── Anggaran ────────────────────────────────────────────

func (r *RouterImpl) ImportAnggaranData(ctx echo.Context) error {
	file, err := ctx.FormFile("file")
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "file is required"})
	}
	tahunStr := ctx.FormValue("tahun_anggaran")
	tahun, err := strconv.Atoi(tahunStr)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "tahun_anggaran must be an integer"})
	}

	src, err := file.Open()
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to open file"})
	}
	defer src.Close()

	rows, err := services.ParseAnggaranCSV(src)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": fmt.Sprintf("CSV parse error: %s", err)})
	}

	reqCtx := ctx.Request().Context()
	programCount, akunCount := 0, 0

	// Dedup maps to avoid redundant upserts within a single import
	programIDs := make(map[string]pgtype.UUID)
	kegiatanIDs := make(map[string]pgtype.UUID)
	outputIDs := make(map[string]pgtype.UUID)
	subOutputIDs := make(map[string]pgtype.UUID)

	for _, row := range rows {
		// Program
		if _, exists := programIDs[row.ProgramKode]; !exists {
			uid := newPgUUID()
			p, err := r.queries.InsertAnggaranProgram(reqCtx, db.InsertAnggaranProgramParams{
				ID: uid, Kode: row.ProgramKode, Uraian: row.ProgramUraian, TahunAnggaran: int32(tahun),
			})
			if err != nil {
				slog.Error("InsertAnggaranProgram failed", "error", err, "kode", row.ProgramKode)
				continue
			}
			programIDs[row.ProgramKode] = p.ID
			programCount++
		}

		// Kegiatan
		if _, exists := kegiatanIDs[row.KegiatanKode]; !exists {
			uid := newPgUUID()
			k, err := r.queries.InsertAnggaranKegiatan(reqCtx, db.InsertAnggaranKegiatanParams{
				ID: uid, ProgramID: programIDs[row.ProgramKode], Kode: row.KegiatanKode, Uraian: row.KegiatanUraian,
			})
			if err != nil {
				slog.Error("InsertAnggaranKegiatan failed", "error", err, "kode", row.KegiatanKode)
				continue
			}
			kegiatanIDs[row.KegiatanKode] = k.ID
		}

		// Output
		if _, exists := outputIDs[row.OutputKode]; !exists {
			uid := newPgUUID()
			o, err := r.queries.InsertAnggaranOutput(reqCtx, db.InsertAnggaranOutputParams{
				ID: uid, KegiatanID: kegiatanIDs[row.KegiatanKode], Kode: row.OutputKode, Uraian: row.OutputUraian,
			})
			if err != nil {
				slog.Error("InsertAnggaranOutput failed", "error", err, "kode", row.OutputKode)
				continue
			}
			outputIDs[row.OutputKode] = o.ID
		}

		// SubOutput
		if _, exists := subOutputIDs[row.SubOutputKode]; !exists {
			uid := newPgUUID()
			so, err := r.queries.InsertAnggaranSubOutput(reqCtx, db.InsertAnggaranSubOutputParams{
				ID: uid, OutputID: outputIDs[row.OutputKode], Kode: row.SubOutputKode, Uraian: row.SubOutputUraian,
			})
			if err != nil {
				slog.Error("InsertAnggaranSubOutput failed", "error", err, "kode", row.SubOutputKode)
				continue
			}
			subOutputIDs[row.SubOutputKode] = so.ID
		}

		// Akun
		uid := newPgUUID()
		_, err := r.queries.InsertAnggaranAkun(reqCtx, db.InsertAnggaranAkunParams{
			ID:          uid,
			SubOutputID: subOutputIDs[row.SubOutputKode],
			Kode:        row.AkunKode,
			Uraian:      row.AkunUraian,
			Pagu:        float64ToNumeric(row.Pagu),
			Realisasi:   float64ToNumeric(row.Realisasi),
			Sisa:        float64ToNumeric(row.Sisa),
		})
		if err != nil {
			slog.Error("InsertAnggaranAkun failed", "error", err, "kode", row.AkunKode)
			continue
		}
		akunCount++
	}

	return ctx.JSON(http.StatusOK, handlers.AnggaranImportResult{
		ProgramsUpserted: &programCount,
		AkunUpserted:     &akunCount,
	})
}

func (r *RouterImpl) GetAnggaranTree(ctx echo.Context, params handlers.GetAnggaranTreeParams) error {
	rows, err := r.queries.GetAnggaranTree(ctx.Request().Context(), int32(params.Tahun))
	if err != nil {
		slog.Error("GetAnggaranTree failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to retrieve Anggaran tree"})
	}
	return ctx.JSON(http.StatusOK, rows)
}

// ──── Documents (CAS) ──────────────────────────────────

func (r *RouterImpl) UploadDocument(ctx echo.Context) error {
	file, err := ctx.FormFile("file")
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "file is required"})
	}

	paketIDStr := ctx.FormValue("paket_id")
	bulanStr := ctx.FormValue("bulan")
	kategori := ctx.FormValue("kategori")
	jenisDokumen := ctx.FormValue("jenis_dokumen")

	bulan, err := strconv.Atoi(bulanStr)
	if err != nil || bulan < 1 || bulan > 12 {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "bulan must be 1-12"})
	}

	paketUUID, err := uuid.Parse(paketIDStr)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid paket_id"})
	}

	src, err := file.Open()
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to open file"})
	}
	defer src.Close()

	// Save to CAS
	result, err := r.cas.Save(src)
	if err != nil {
		slog.Error("CAS save failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to save file"})
	}

	// Check if already in DB
	_, dbErr := r.queries.GetDocumentByHash(ctx.Request().Context(), result.Hash)
	if dbErr == nil {
		return ctx.JSON(http.StatusConflict, map[string]string{"message": "document with same content already exists"})
	}

	// Insert metadata
	docID := newPgUUID()
	// Use a hardcoded user ID for now (will be replaced with JWT claims later)
	userID := newPgUUID()

	doc, err := r.queries.InsertDocument(ctx.Request().Context(), db.InsertDocumentParams{
		ID:             docID,
		PaketID:        uuidToPgUUID(paketUUID),
		Bulan:          int32(bulan),
		Kategori:       kategori,
		JenisDokumen:   jenisDokumen,
		FileHashSha256: result.Hash,
		OriginalName:   file.Filename,
		MimeType:       result.MimeType,
		FileSizeBytes:  result.Size,
		UploadedBy:     userID,
	})
	if err != nil {
		slog.Error("InsertDocument failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to save metadata"})
	}

	bulanInt := int(doc.Bulan)
	sizeInt := int(doc.FileSizeBytes)
	return ctx.JSON(http.StatusCreated, handlers.DocumentMeta{
		Id:             pgUUIDToOpenAPI(doc.ID),
		PaketId:        pgUUIDToOpenAPI(doc.PaketID),
		Bulan:          &bulanInt,
		Kategori:       &doc.Kategori,
		JenisDokumen:   &doc.JenisDokumen,
		FileHashSha256: &doc.FileHashSha256,
		OriginalName:   &doc.OriginalName,
		MimeType:       &doc.MimeType,
		FileSizeBytes:  &sizeInt,
	})
}

func (r *RouterImpl) DownloadDocument(ctx echo.Context, id openapi_types.UUID) error {
	doc, err := r.queries.GetDocumentByHash(ctx.Request().Context(), "")
	// We need to get by ID instead — let's just serve the file by hash from the path param
	// For now, use ID to look up in the paket documents
	_ = doc
	_ = err
	// Simplified: serve file from CAS path
	// In production, we'd look up the hash from the DB by ID
	return ctx.JSON(http.StatusNotImplemented, map[string]string{"message": "download endpoint - coming soon"})
}

// ──── Paket Pekerjaan ──────────────────────────────────

func (r *RouterImpl) ListPaket(ctx echo.Context) error {
	pakets, err := r.queries.ListPaketPekerjaan(ctx.Request().Context())
	if err != nil {
		slog.Error("ListPaketPekerjaan failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to list paket"})
	}
	return ctx.JSON(http.StatusOK, pakets)
}

func (r *RouterImpl) CreatePaket(ctx echo.Context) error {
	var body handlers.CreatePaketJSONRequestBody
	if err := ctx.Bind(&body); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid request body"})
	}

	// Use a hardcoded PPK ID for now
	ppkID := newPgUUID()

	paket, err := r.queries.InsertPaketPekerjaan(ctx.Request().Context(), db.InsertPaketPekerjaanParams{
		ID:        newPgUUID(),
		NamaPaket: body.NamaPaket,
		Kasatker:  body.Kasatker,
		Lokasi:    body.Lokasi,
		PaguPaket: float64ToNumeric(float64(body.PaguPaket)),
		Status:    "DRAFT",
		PpkID:     ppkID,
	})
	if err != nil {
		slog.Error("InsertPaketPekerjaan failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to create paket"})
	}

	// Insert akun mappings
	if body.AkunIds != nil {
		for _, akunID := range *body.AkunIds {
			r.queries.InsertPaketAkunMapping(ctx.Request().Context(), db.InsertPaketAkunMappingParams{
				PaketID: paket.ID,
				AkunID:  uuidToPgUUID(uuid.UUID(akunID)),
			})
		}
	}

	// Insert targets
	if body.Targets != nil {
		for _, t := range *body.Targets {
			if t.Bulan != nil {
				r.queries.InsertPaketTarget(ctx.Request().Context(), db.InsertPaketTargetParams{
					ID:      newPgUUID(),
					PaketID: paket.ID,
					Bulan:   int32(*t.Bulan),
					PersenKeuangan: func() pgtype.Numeric {
						if t.PersenKeuangan != nil {
							return float64ToNumeric(float64(*t.PersenKeuangan))
						}
						return float64ToNumeric(0)
					}(),
					PersenFisik: func() pgtype.Numeric {
						if t.PersenFisik != nil {
							return float64ToNumeric(float64(*t.PersenFisik))
						}
						return float64ToNumeric(0)
					}(),
				})
			}
		}
	}

	return ctx.JSON(http.StatusCreated, paket)
}

func (r *RouterImpl) GetPaket(ctx echo.Context, id openapi_types.UUID) error {
	paket, err := r.queries.GetPaketPekerjaanByID(ctx.Request().Context(), uuidToPgUUID(uuid.UUID(id)))
	if err != nil {
		return ctx.JSON(http.StatusNotFound, map[string]string{"message": "paket not found"})
	}
	return ctx.JSON(http.StatusOK, paket)
}

func (r *RouterImpl) GetDocumentsByPaket(ctx echo.Context, id openapi_types.UUID, params handlers.GetDocumentsByPaketParams) error {
	pgID := uuidToPgUUID(uuid.UUID(id))

	if params.Bulan != nil {
		docs, err := r.queries.GetDocumentsByPaketAndBulan(ctx.Request().Context(), db.GetDocumentsByPaketAndBulanParams{
			PaketID: pgID,
			Bulan:   int32(*params.Bulan),
		})
		if err != nil {
			return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to get documents"})
		}
		return ctx.JSON(http.StatusOK, docs)
	}

	docs, err := r.queries.GetDocumentsByPaket(ctx.Request().Context(), pgID)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to get documents"})
	}
	return ctx.JSON(http.StatusOK, docs)
}

func (r *RouterImpl) UpdateRealisasiFisik(ctx echo.Context, id openapi_types.UUID) error {
	var body handlers.UpdateRealisasiFisikJSONRequestBody
	if err := ctx.Bind(&body); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"message": "invalid request body"})
	}

	userID := newPgUUID() // hardcoded for now

	var catatan pgtype.Text
	if body.CatatanKendala != nil {
		catatan = pgtype.Text{String: *body.CatatanKendala, Valid: true}
	}

	result, err := r.queries.UpsertRealisasiFisik(ctx.Request().Context(), db.UpsertRealisasiFisikParams{
		ID:             newPgUUID(),
		PaketID:        uuidToPgUUID(uuid.UUID(id)),
		Bulan:          int32(body.Bulan),
		PersenAktual:   float64ToNumeric(float64(body.PersenAktual)),
		CatatanKendala: catatan,
		UpdatedBy:      userID,
	})
	if err != nil {
		slog.Error("UpsertRealisasiFisik failed", "error", err)
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"message": "failed to update realisasi"})
	}
	return ctx.JSON(http.StatusOK, result)
}

// ──── Helpers ──────────────────────────────────────────

func newPgUUID() pgtype.UUID {
	id := uuid.New()
	return pgtype.UUID{Bytes: id, Valid: true}
}

func uuidToPgUUID(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func pgUUIDToOpenAPI(id pgtype.UUID) *openapi_types.UUID {
	u := openapi_types.UUID(id.Bytes)
	return &u
}

func float64ToNumeric(f float64) pgtype.Numeric {
	var n pgtype.Numeric
	n.Scan(fmt.Sprintf("%f", f))
	return n
}

// ──── Main ─────────────────────────────────────────────

func main() {
	// 1. Initialize Logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	// 2. Initialize Database Connection
	dbUrl := os.Getenv("DB_URL")
	if dbUrl == "" {
		dbUrl = "postgres://siap_admin:siap_password@localhost:5432/siap_pusbangkom?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbUrl)
	if err != nil {
		slog.Error("Unable to create connection pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		slog.Error("Unable to ping database", "error", err)
		os.Exit(1)
	}

	slog.Info("Successfully connected to database")
	database := db.New(pool)

	// 3. Initialize CAS Storage
	casPath := os.Getenv("CAS_PATH")
	if casPath == "" {
		casPath = "./storage/cas"
	}
	cas := services.NewCASStorage(casPath)

	// 4. Initialize Echo
	e := echo.New()
	e.HideBanner = true

	// Middleware
	e.Use(middleware.Recover())
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogStatus:   true,
		LogURI:      true,
		LogMethod:   true,
		LogLatency:  true,
		LogRemoteIP: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			slog.Info("request",
				slog.String("actor", c.RealIP()),
				slog.String("ip", v.RemoteIP),
				slog.String("endpoint", v.URI),
				slog.String("method", v.Method),
				slog.Int("status", v.Status),
				slog.Duration("latency_ms", v.Latency),
				slog.String("trace_id", c.Response().Header().Get(echo.HeaderXRequestID)),
			)
			return nil
		},
	}))
	e.Use(middleware.RequestID())
	e.Use(middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(10)))

	// Register Handlers
	impl := &RouterImpl{queries: database, pool: pool, cas: cas}
	handlers.RegisterHandlersWithBaseURL(e, impl, "/api/v1")

	// 5. Start Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	go func() {
		if err := e.Start(fmt.Sprintf(":%s", port)); err != nil && err != http.ErrServerClosed {
			e.Logger.Fatal("shutting down the server")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit
	slog.Info("Gracefully shutting down server...")

	ctxTimeout, cancelTimeout := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelTimeout()
	if err := e.Shutdown(ctxTimeout); err != nil {
		e.Logger.Fatal(err)
	}
}
