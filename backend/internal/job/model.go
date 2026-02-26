package job

import "time"

type Report struct {
	BatchID            int32
	Status             string
	TotalFiles         int32
	ProcessedFiles     int32
	FailedCount        int32
	TotalOriginalSize  int64
	TotalOptimizedSize int64
	CompressionRatio   float64
	Duration           time.Duration
}
