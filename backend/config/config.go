package config

import (
	"context"

	"github.com/sethvargo/go-envconfig"
)

type Config struct {
	Port         string `env:"SHRINKLY_PORT, default=8080"`
	DatabaseURL  string `env:"SHRINKLY_DATABASE_URL, required"`
	MaxWorkers   int    `env:"SHRINKLY_MAX_WORKERS, default=4"`
	CRF          int    `env:"SHRINKLY_CRF, default=23"`
	Preset       string `env:"SHRINKLY_PRESET, default=medium"`
	AudioBitrate string `env:"SHRINKLY_AUDIO_BITRATE, default=128k"`
	InputDir     string `env:"SHRINKLY_INPUT_DIR, default=./input"`
	OutputDir    string `env:"SHRINKLY_OUTPUT_DIR, default=./output"`
}

func Load() (*Config, error) {
	var cfg Config
	if err := envconfig.Process(context.Background(), &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}
