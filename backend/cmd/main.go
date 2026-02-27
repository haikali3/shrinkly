package main

import (
	"context"
	"log"
	"net/http"
	"shrinkly/backend/config"
	"shrinkly/backend/internal/api"
	"shrinkly/backend/internal/db"
	"shrinkly/backend/internal/job"
	"shrinkly/backend/internal/worker"

	"github.com/jackc/pgx/v5"
)

func main() {
	// load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	// connect to db
	conn, err := pgx.Connect(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close(context.Background())
	queries := db.New(conn)

	// init worker pool + job manager
	pool := worker.NewPool(cfg.MaxWorkers, cfg)
	manager := job.NewManager(queries, pool, cfg)

	// wire router + start http server
	handler := api.NewHandler(manager)
	router := api.NewRouter(handler)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatal(err)
	}
}
