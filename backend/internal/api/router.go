package api

import "github.com/go-chi/chi/v5"

func NewRouter(h *Handler) *chi.Mux {
	r := chi.NewRouter()
	r.Post("/batch", h.HandleCreateBatch)
	r.Get("/batch/{id}", h.HandleGetBatchReport)
	return r
}
