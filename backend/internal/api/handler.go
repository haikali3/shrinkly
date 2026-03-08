package api

import (
	"context"
	"fmt"
	"mime/multipart"
	"net/http"
	"shrinkly/backend/config"
	"shrinkly/backend/internal/db"
	"shrinkly/backend/internal/job"
	"shrinkly/backend/internal/logger"
	"shrinkly/backend/internal/storage"
	"strconv"

	"github.com/go-chi/chi/v5"
	"go.uber.org/zap"
)

type Handler struct {
	Creator  BatchCreator
	Reporter BatchReporter
	Cfg      *config.Config
	Queries  *db.Queries
}

type BatchCreator interface {
	CreateBatch(ctx context.Context, filePaths []string, setting job.CompressionSettings) (*job.Report, error)
}

type BatchReporter interface {
	GetBatchReport(ctx context.Context, batchID int32) (*job.Report, error)
}

type VideoFetcher interface {
	GetVideoByID(ctx context.Context, videoID string) (db.Video, error)
}

var (
	_ BatchCreator  = (*job.Compressor)(nil)
	_ BatchReporter = (*job.Compressor)(nil)
)

func NewHandler(m *job.Compressor, cfg *config.Config, queries *db.Queries) *Handler {
	return &Handler{Creator: m, Reporter: m, Cfg: cfg, Queries: queries}
}

func (h *Handler) HandleHealthCheck(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, "ok", nil)
}

func (h *Handler) HandleCreateBatch(w http.ResponseWriter, r *http.Request) {
	// 1. parse multipart upload
	logger.Get().Info("content_type", zap.String("ct", r.Header.Get("Content-Type")))

	const maxMultipartMemory = 32 << 20

	if err := r.ParseMultipartForm(maxMultipartMemory); err != nil {
		logger.Get().Error("failed to parse multipart form", zap.Error(err))
		writeJSON(w, http.StatusBadRequest, "failed to parse form", nil)
		return
	}

	settings := job.CompressionSettings{
		Codec:      r.FormValue("codec"),
		Preset:     r.FormValue("preset"),
		Resolution: r.FormValue("resolution"),
		Bitrate:    r.FormValue("bitrate"),
	}
	// 2. validate compressing settings
	if crfValue := r.FormValue("crf"); crfValue != "" {
		crf, err := strconv.Atoi(crfValue)
		if err != nil {
			logger.Get().Error("invalid CRF value", zap.Error(err))
			writeJSON(w, http.StatusBadRequest, "invalid CRF value", nil)
			return
		}
		settings.CRF = crf
	}

	settings.SetDefaults()

	if err := settings.Valid(); err != nil {
		logger.Get().Error("invalid compression settings", zap.Error(err))
		writeJSON(w, http.StatusBadRequest, err.Error(), nil)
		return
	}

	files := r.MultipartForm.File["files"]
	logger.Get().Info("received files", zap.Int("count", len(files)))
	// 3. save files to InputDir
	filePaths := make([]string, 0, len(files))
	for _, fileHeader := range files {
		dstPath, err := h.saveUploadedFile(fileHeader)

		if err != nil {
			logger.Get().Error("save uploaded file", zap.Error(err))
			writeJSON(w, http.StatusInternalServerError, "failed to save uploaded file", nil)
			return
		}

		filePaths = append(filePaths, dstPath)
	}

	// call CreateBatch to create a batch and return the report
	report, err := h.Creator.CreateBatch(r.Context(), filePaths, settings)

	if err != nil {
		logger.Get().Error("failed to create batch", zap.Error(err))
		writeJSON(w, http.StatusInternalServerError, "failed to create batch", nil)
		return
	}

	writeJSON(w, http.StatusCreated, "batch created", report)
}

func (h *Handler) HandleBatchReport(w http.ResponseWriter, r *http.Request) {
	// 1. parse batchID from url
	idStr := chi.URLParam(r, "id")

	batchID, err := strconv.Atoi(idStr)
	if err != nil {
		logger.Get().Error("failed to parse batch id", zap.Error(err))
		writeJSON(w, http.StatusBadRequest, "invalid batch id", nil)
		return
	}

	// 2. call h.Manager.GetBatchReport
	report, err := h.Reporter.GetBatchReport(r.Context(), int32(batchID))
	if err != nil {
		logger.Get().Error("failed to get batch report", zap.Error(err))
		writeJSON(w, http.StatusNotFound, "batch not found", nil)
		return
	}

	// 3. return report as json
	writeJSON(w, http.StatusOK, "batch report retrieved", report)
}

func (h *Handler) HandleCompressionOptions(w http.ResponseWriter, _ *http.Request) {
	options := job.GetCompressionOptions()
	writeJSON(w, http.StatusOK, "compression options retrieved", options)
}

func (h *Handler) saveUploadedFile(fileHeader *multipart.FileHeader) (string, error) {
	src, err := fileHeader.Open()
	if err != nil {
		return "", fmt.Errorf("open uploaded file: %w", err)
	}
	defer src.Close()

	dstPath := h.Cfg.InputDir + "/" + fileHeader.Filename
	if err := storage.SaveFile(src, dstPath); err != nil {
		return "", fmt.Errorf("save uploaded file: %w", err)
	}

	return dstPath, nil
}

func (h *Handler) HandleDownload(w http.ResponseWriter, r *http.Request) {
	// 1.parse videoID from URL
	idStr := chi.URLParam(r, "id")
	videoID, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, "invalid video ID", nil)
		return
	}
	// 2.fetch that video from DB
	video, err := h.Queries.GetVideo(r.Context(), int32(videoID))
	if err != nil {
		writeJSON(w, http.StatusNotFound, "video not found", nil)
		return
	}

	// 3. ensure status == "completed"
	// 4. ensure optimized_filename isnt empty and smaller than original filename
	// 5. serve the file from disk with attachment header
}
