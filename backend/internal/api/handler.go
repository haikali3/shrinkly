package api

import (
	"context"
	"encoding/json"
	"net/http"
	"shrinkly/backend/config"
	"shrinkly/backend/internal/job"
	"shrinkly/backend/internal/storage"
	"strconv"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	Creator  BatchCreator
	Reporter BatchReporter
	Cfg      *config.Config
}

type BatchCreator interface {
	CreateBatch(ctx context.Context, filePaths []string) (int32, error)
}

type BatchReporter interface {
	GetBatchReport(ctx context.Context, batchID int32) (*job.Report, error)
}

func NewHandler(m *job.Manager, cfg *config.Config) *Handler {
	return &Handler{Creator: m, Reporter: m, Cfg: cfg}
}

func (h *Handler) HandleHealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handler) HandleCreateBatch(w http.ResponseWriter, r *http.Request) {
	// 1. parse multipart upload
	err := r.ParseMultipartForm(32 << 20) // 32MB max memory
	if err != nil {
		http.Error(w, "failed to parse form", http.StatusBadRequest)
		return
	}

	files := r.MultipartForm.File["files"]
	// 2. save files to InputDir, call m.CreateBatch and return 201 with batch ID
	var filePaths []string
	for _, fileHeader := range files {
		// open the uploaded files
		src, err := fileHeader.Open()
		if err != nil {
			http.Error(w, "failed to open uploaded file", http.StatusInternalServerError)
			return
		}

		dstPath := h.Cfg.InputDir + "/" + fileHeader.Filename
		if err := storage.SaveFile(src, dstPath); err != nil {
			src.Close()
			http.Error(w, "failed to save file", http.StatusInternalServerError)
			return
		}
		src.Close()

		filePaths = append(filePaths, dstPath)
	}

	// call CreateBatch with saved paths
	batchID, err := h.Creator.CreateBatch(r.Context(), filePaths)
	if err != nil {
		http.Error(w, "failed to create batch", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]int32{"batch_id": batchID})
}

func (h *Handler) HandleGetBatchReport(w http.ResponseWriter, r *http.Request) {
	// 1. parse batchID from url
	idStr := chi.URLParam(r, "id")
	batchID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid batch id", http.StatusBadRequest)
		return
	}

	// 2. call h.Manager.GetBatchReport
	report, err := h.Reporter.GetBatchReport(r.Context(), int32(batchID))
	if err != nil {
		http.Error(w, "batch not found", http.StatusNotFound)
		return
	}

	// 3. return report as json
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(report)
}
