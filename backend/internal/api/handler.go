package api

import (
	"io"
	"net/http"
	"os"
	"shrinkly/backend/internal/job"
)

type Handler struct {
	*job.Manager
}

func NewHandler(m *job.Manager) *Handler {
	return &Handler{Manager: m}
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
		defer src.Close()

		// create destination file
		dstPath := h.Cfg.InputDir + "/" + fileHeader.Filename
		dst, err := os.Create(dstPath)
		if err != nil {
			http.Error(w, "failed to save file", http.StatusInternalServerError)
			return
		}
		defer dst.Close()

		// copy contents
		if _, err := io.Copy(dst, src); err != nil {
			http.Error(w, "failed to write file", http.StatusInternalServerError)
			return
		}
		filePaths = append(filePaths, dstPath)
	}

	// call CreateBatch with saved paths
	if err := h.Manager.CreateBatch(r.Context(), filePaths); err != nil {
		http.Error(w, "failed to create batch", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}
