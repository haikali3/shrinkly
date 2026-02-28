package api

import (
	"context"
	"net/http"
	"shrinkly/backend/config"
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
}

type BatchCreator interface {
	CreateBatch(ctx context.Context, filePaths []string) (*job.Report, error)
}

type BatchReporter interface {
	GetBatchReport(ctx context.Context, batchID int32) (*job.Report, error)
}

func NewHandler(m *job.Manager, cfg *config.Config) *Handler {
	return &Handler{Creator: m, Reporter: m, Cfg: cfg}
}

func (h *Handler) HandleHealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, "ok", nil)
}

func (h *Handler) HandleCreateBatch(w http.ResponseWriter, r *http.Request) {
	// 1. parse multipart upload
	logger.Get().Info("content_type", zap.String("ct", r.Header.Get("Content-Type")))
	err := r.ParseMultipartForm(32 << 20) // 32MB max memory
	if err != nil {
		logger.Get().Error("failed to parse multipart form", zap.Error(err))
		writeJSON(w, http.StatusBadRequest, "failed to parse form", nil)
		return
	}

	files := r.MultipartForm.File["files"]
	logger.Get().Info("received files", zap.Int("count", len(files)))
	// 2. save files to InputDir, call m.CreateBatch and return 201 with batch ID
	var filePaths []string
	for _, fileHeader := range files {
		// open the uploaded files
		src, err := fileHeader.Open()
		if err != nil {
			logger.Get().Error("failed to open uploaded file", zap.Error(err))
			writeJSON(w, http.StatusInternalServerError, "failed to open uploaded file", nil)
			return
		}

		dstPath := h.Cfg.InputDir + "/" + fileHeader.Filename
		if err := storage.SaveFile(src, dstPath); err != nil {
			src.Close()
			logger.Get().Error("failed to save uploaded file", zap.Error(err))
			writeJSON(w, http.StatusInternalServerError, "failed to save uploaded file", nil)
			return
		}
		src.Close()

		filePaths = append(filePaths, dstPath)
	}

	// call CreateBatch with saved paths
	report, err := h.Creator.CreateBatch(r.Context(), filePaths)
	if err != nil {
		logger.Get().Error("failed to create batch", zap.Error(err))
		writeJSON(w, http.StatusInternalServerError, "failed to create batch", nil)
		return
	}

	writeJSON(w, http.StatusCreated, "batch created", report)
}

func (h *Handler) HandleGetBatchReport(w http.ResponseWriter, r *http.Request) {
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
