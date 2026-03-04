package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

func NewRouter(h *Handler, allowedOrigins string) *chi.Mux {
	r := chi.NewRouter()

	r.Use(corsMiddleware(allowedOrigins))

	r.Get("/", h.HandleHealthCheck)
	r.Post("/batch", h.HandleCreateBatch)
	r.Get("/batch/{id}", h.HandleBatchReport)
	return r
}

func corsMiddleware(allowedOrigins string) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", allowedOrigins)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
