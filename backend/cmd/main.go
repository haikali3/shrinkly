package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"shrinkly/backend/config"
	"shrinkly/backend/internal/api"
	"shrinkly/backend/internal/db"
	"shrinkly/backend/internal/job"
	"shrinkly/backend/internal/logger"
	"shrinkly/backend/internal/worker"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

func main() {

	godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		logger.Get().Fatal("failed to load config", zap.Error(err))
	}

	// create input + output directories if they don't exist
	os.MkdirAll(cfg.InputDir, 0755)
	os.MkdirAll(cfg.OutputDir, 0755)

	// init logger
	logger.Init()
	defer logger.Sync()

	// connect to db
	conn, err := pgx.Connect(context.Background(), cfg.DatabaseURL)
	if err != nil {
		logger.Get().Fatal("failed to connect to database", zap.Error(err))
	}
	defer conn.Close(context.Background())
	queries := db.New(conn)

	// init worker pool + job manager
	pool := worker.NewPool(cfg.MaxWorkers, cfg)
	manager := job.NewManager(queries, pool, cfg)

	// wire router + start http server
	handler := api.NewHandler(manager, cfg)
	router := api.NewRouter(handler)
	logger.Get().Info("server started", zap.String("port", cfg.Port))
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		logger.Get().Error("failed to start server", zap.Error(err))
		log.Fatal(err)
	}
}
