package job

import (
	"context"
	"shrinkly/backend/config"
	"shrinkly/backend/internal/db"
	"shrinkly/backend/internal/worker"
)

type Manager struct {
	queries *db.Queries
	pool    *worker.Pool
	cfg     *config.Config
}

func NewManager(queries *db.Queries, pool *worker.Pool, cfg *config.Config) *Manager {
	return &Manager{
		queries: queries,
		pool:    pool,
		cfg:     cfg,
	}
}

func (m *Manager) CreateBatch(ctx context.Context, filePath []string) {
	//  1. create batch record
	batch, err := m.queries.CreateBatch(ctx, db.CreateBatchParams{
		TotalFiles: int32(len(filePath)),
		Status:     "pending",
	})
	if err != nil {
		return
	}

	// 2. create a video record for each file
	var videos []db.Video
	for _, path := range filePath {
		video, err := m.queries.CreateVideo(ctx, db.CreateVideoParams{
			BatchID:          batch.ID,
			OriginalFilename: path,
			OriginalSize:     0,
			Status:           "pending",
		})
		if err != nil {
			continue
		}
		videos = append(videos, video)
	}
}
