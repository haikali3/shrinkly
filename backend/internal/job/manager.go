package job

import (
	"context"
	"shrinkly/backend/config"
	"shrinkly/backend/internal/db"
	"shrinkly/backend/internal/worker"

	"github.com/jackc/pgx/v5/pgtype"
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

func (m *Manager) CreateBatch(ctx context.Context, filePath []string) error {
	//  1. create batch record
	batch, err := m.queries.CreateBatch(ctx, db.CreateBatchParams{
		TotalFiles: int32(len(filePath)),
		Status:     "pending",
	})
	if err != nil {
		return err
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
			return err
		}
		videos = append(videos, video)
	}

	// 3. build worker tasks
	tasks := make([]worker.Task, len(videos))
	for i, video := range videos {
		tasks[i] = worker.Task{
			VideoID:    video.ID,
			InputPath:  video.OriginalFilename,
			OutputPath: m.cfg.OutputDir + "/" + video.OriginalFilename,
		}
	}

	// 4. send to pool
	results := m.pool.Process(tasks)

	// 5. update video records based on results
	for i, r := range results {
		if r.Success {
			m.queries.UpdateVideoSizes(ctx, db.UpdateVideoSizesParams{
				ID:                r.VideoID,
				OptimizedFilename: pgtype.Text{String: tasks[i].OutputPath, Valid: true},
				OptimizedSize:     pgtype.Int8{Int64: r.OptimizedSize, Valid: true},
				Status:            "completed",
			})
		} else {
			m.queries.UpdateVideoStatus(ctx, db.UpdateVideoStatusParams{
				ID:           r.VideoID,
				Status:       "failed",
				ErrorMessage: pgtype.Text{String: r.Error.Error(), Valid: true},
			})
		}
	}

	return nil
}

func (m *Manager) GetBatchReport(ctx context.Context, batchID int32) (*Report, error) {
	// 1. fetch the batch + videos
	batch, err := m.queries.GetBatch(ctx, batchID)
	if err != nil {
		return nil, err
	}

	// 2. count fail,compute ratio and duraiton
	// 3. return report

}
