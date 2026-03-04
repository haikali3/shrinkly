package worker

import (
	"os"
	"os/exec"
	"shrinkly/backend/internal/logger"
	"strconv"

	"go.uber.org/zap"
)

type CompressionSettings struct {
	Codec      string `json:"codec"`
	CRF        int    `json:"crf"`
	Preset     string `json:"preset"`
	Resolution string `json:"resolution"`
	Bitrate    string `json:"bitrate"`
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
	args := []string{"-y", "-i", inputPath,
		"-c:v", setting.Codec, // video codec
		"-preset", setting.Preset, // compression speed/efficiency tradeoff
		"-crf", strconv.Itoa(setting.CRF), // quality level
		"-c:a", "aac", // default audio codec
	}

	if setting.Resolution != "" {
		args = append(args, "-vf", "scale="+setting.Resolution) // set resolution
	}
	if setting.Bitrate != "" {
		args = append(args, "-b:v", setting.Bitrate) // set bitrate
	}
	args = append(args, outputPath)

	cmd := exec.Command("ffmpeg", args...)
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
