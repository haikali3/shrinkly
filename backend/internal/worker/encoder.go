package worker

import (
	"os"
	"os/exec"
	"shrinkly/backend/config"
	"strconv"
)

func Encode(inputPath, outputPath string, cfg *config.Config) (originalSize, optimizedSize int64, err error) {
	// 1. get original file size
	info, err := os.Stat(inputPath)
	if err != nil {
		return 0, 0, err
	}
	originalSize = info.Size()
	// 2. run ffmpeg command from config
	cmd := exec.Command("ffmpeg", "-i", inputPath,
		"-c:v", cfg.Codec,
		"-preset", cfg.Preset,
		"-crf", strconv.Itoa(cfg.CRF),
		"-c:a", "aac",
		"-b:a", cfg.AudioBitrate,
		outputPath,
	)
	if err := cmd.Run(); err != nil {
		return originalSize, 0, err
	}
	// 3. get optimized file size
	info, err = os.Stat(outputPath)
	if err != nil {
		return originalSize, 0, err
	}
	optimizedSize = info.Size()

	// 4. return &Result{OriginalSize, OptimizedSize}
	return originalSize, optimizedSize, nil
}
