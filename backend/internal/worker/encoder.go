package worker

import (
	"os"
	"os/exec"
	"shrinkly/backend/internal/logger"
	"strconv"
	"strings"

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

	codec, err := probeCodec(inputPath)
	if err != nil {
		logger.Get().Error("failed to probe codec", zap.String("path", inputPath), zap.Error(err))
		return 0, 0, err
	}
	if codec == "hevc" && setting.Codec == "h265" {
		// already h265, use higher crf to force smaller size
		setting.CRF = 32
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
	out, err := cmd.CombinedOutput()
	if err != nil {
		logger.Get().Error("ffmpeg command failed", zap.Error(err), zap.String("output", string(out)))
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

func probeCodec(inputPath string) (string, error) {
	out, err := exec.Command("ffprobe",
		"-v", "error",
		"-select_streams", "v:0",
		"-show_entries", "stream=codec_name",
		"-of", "default=noprint_wrappers=1:nokey=1",
		inputPath,
	).Output()
	if err != nil {
		logger.Get().Error("ffprobe command failed", zap.Error(err), zap.String("output", string(out)))
		return "", err
	}
	return strings.TrimSpace(string(out)), nil

}
