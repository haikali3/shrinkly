package api

import (
	"encoding/json"
	"net/http"
)

type Response struct {
	StatusCode int    `json:"status_code,omitempty"`
	Message    string `json:"message,omitempty"`
	Data       any    `json:"data,omitempty"`
}

func writeJSON(w http.ResponseWriter, statusCode int, message string, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(Response{
		StatusCode: statusCode,
		Message:    message,
		Data:       data,
	})
}
