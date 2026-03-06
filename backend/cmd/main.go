package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"shrinkly/backend/config"
	"shrinkly/backend/internal/api"
	"shrinkly/backend/internal/db"
	"shrinkly/backend/internal/job"
	"shrinkly/backend/internal/logger"
	"shrinkly/backend/internal/worker"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	if err := godotenv.Load(); err != nil {
		return fmt.Errorf("load environment variables: %w", err)
	}

	// init logger
	if err := logger.Init(); err != nil {
		return fmt.Errorf("init logger: %w", err)
	}
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	// create input + output directories if they don't exist
	if err := os.MkdirAll(cfg.InputDir, 0755); err != nil {
		return fmt.Errorf("create input directory: %w", err)
	}
	if err := os.MkdirAll(cfg.OutputDir, 0755); err != nil {
		return fmt.Errorf("create output directory: %w", err)
	}

	dbPool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("connect to database: %w", err)
	}
	defer dbPool.Close()
	queries := db.New(dbPool)

	// init worker pool + job manager
	workerPool := worker.NewPool(cfg.MaxWorkers)
	manager := job.NewManager(queries, workerPool, cfg)

	// wire router + start http server
	handler := api.NewHandler(manager, cfg)
	router := api.NewRouter(handler, cfg.AllowedOrigins)
	logger.Get().Info("starting server", zap.String("port", cfg.Port))

	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		return fmt.Errorf("start server: %w", err)
	}
	return nil
}
