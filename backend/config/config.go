package config

import (
	"context"

	"github.com/sethvargo/go-envconfig"
)

type Config struct {
	Port           string `env:"SHRINKLY_PORT, default=8080"`
	DatabaseURL    string `env:"SHRINKLY_DATABASE_URL, required"`
	MaxWorkers     int    `env:"SHRINKLY_MAX_WORKERS, default=4"`
	InputDir       string `env:"SHRINKLY_INPUT_DIR, default=./input"`
	OutputDir      string `env:"SHRINKLY_OUTPUT_DIR, default=./output"`
	AllowedOrigins string `env:"SHRINKLY_ALLOWED_ORIGINS, default=http://localhost:3000"`
}

func Load() (*Config, error) {
	var cfg Config
	if err := envconfig.Process(context.Background(), &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}
