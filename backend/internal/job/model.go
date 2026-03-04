package job

import (
	"errors"
	"time"
)

type Report struct {
	BatchID            int32         `json:"batch_id"`
	Status             string        `json:"status"`
	TotalFiles         int32         `json:"total_files"`
	ProcessedFiles     int32         `json:"processed_files"`
	FailedCount        int32         `json:"failed_count"`
	TotalOriginalSize  int64         `json:"total_original_size"`
	TotalOptimizedSize int64         `json:"total_optimized_size"`
	CompressionRatio   float64       `json:"compression_ratio"`
	Duration           time.Duration `json:"duration"`
	Videos             []VideoResult `json:"videos"`
}

type VideoResult struct {
	VideoID       int32  `json:"video_id"`
	Filename      string `json:"filename"`
	OriginalSize  int64  `json:"original_size"`
	OptimizedSize int64  `json:"optimized_size"`
	Status        string `json:"status"`
}

type CompressionSettings struct {
	Codec  string `json:"codec"`
	CRF    int    `json:"crf"`
	Preset string `json:"preset"`
}

func (s CompressionSettings) Valid() error {
	if s.Codec == "" {
		return errors.New("codec is required")
	}
	if s.CRF == 0 {
		return errors.New("crf is required")
	}
	if s.Preset == "" {
		return errors.New("preset is required")
	}
	return nil
}

func (s *CompressionSettings) SetDefaults() {
	if s.Codec == "" {
		s.Codec = "libx265"
	}
	if s.CRF == 0 {
		s.CRF = 32
	}
	if s.Preset == "" {
		s.Preset = "medium"
	}
}
