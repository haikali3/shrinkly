package worker

import (
	"os"
	"os/exec"
	"shrinkly/backend/internal/logger"
	"strconv"

	"go.uber.org/zap"
)

type CompressionSettings struct {
	Codec  string `json:"codec"`
	CRF    int    `json:"crf"`
	Preset string `json:"preset"`
}

func Encode(inputPath, outputPath string, setting *CompressionSettings) (originalSize, optimizedSize int64, err error) {
	// 1. get original file size
	info, err := os.Stat(inputPath)
	if err != nil {
		logger.Get().Error("failed to stat input file", zap.String("path", inputPath), zap.Error(err))
		return 0, 0, err
	}
	originalSize = info.Size()
	// 2. run ffmpeg command from config
	cmd := exec.Command("ffmpeg", "-i", inputPath,
		"-c:v", setting.Codec,
		"-preset", setting.Preset,
		"-crf", strconv.Itoa(setting.CRF),
		"-c:a", "aac",
		outputPath,
	)
	if err := cmd.Run(); err != nil {
		logger.Get().Error("ffmpeg command failed", zap.Error(err))
		return originalSize, 0, err
	}
	// 3. get optimized file size
	info, err = os.Stat(outputPath)
	if err != nil {
		logger.Get().Error("failed to stat output file", zap.String("path", outputPath), zap.Error(err))
		return originalSize, 0, err
	}
	optimizedSize = info.Size()

	// 4. return &Result{OriginalSize, OptimizedSize}
	return originalSize, optimizedSize, nil
}
