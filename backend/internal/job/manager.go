package job

import (
	"context"
	"path/filepath"
	"shrinkly/backend/config"
	"shrinkly/backend/internal/db"
	"shrinkly/backend/internal/logger"
	"shrinkly/backend/internal/worker"

	"github.com/jackc/pgx/v5/pgtype"
	"go.uber.org/zap"
)

type Manager struct {
	queries *db.Queries
	pool    *worker.Pool
	Cfg     *config.Config
}

func NewManager(queries *db.Queries, pool *worker.Pool, cfg *config.Config) *Manager {
	return &Manager{
		queries: queries,
		pool:    pool,
		Cfg:     cfg,
	}
}

func (m *Manager) CreateBatch(ctx context.Context, filePath []string) (*Report, error) {
	//  1. create batch record
	batch, err := m.queries.CreateBatch(ctx, db.CreateBatchParams{
		TotalFiles: int32(len(filePath)),
		Status:     "pending",
	})
	if err != nil {
		logger.Get().Error("failed to create batch", zap.Error(err))
		return nil, err
	}

	// 2. create a video record for each file
	var videos []db.Video
	for _, path := range filePath {
		video, err := m.queries.CreateVideo(ctx, db.CreateVideoParams{
			BatchID:          batch.ID,
			OriginalFilename: path,
			OriginalSize:     batch.TotalOriginalSize,
			Status:           "pending",
		})
		if err != nil {
			logger.Get().Error("failed to create video", zap.Error(err))
			return nil, err
		}
		videos = append(videos, video)
	}

	// 3. build worker tasks
	tasks := make([]worker.Task, len(videos))
	for i, video := range videos {
		tasks[i] = worker.Task{
			VideoID:    video.ID,
			InputPath:  video.OriginalFilename,
			OutputPath: m.Cfg.OutputDir + "/" + filepath.Base(video.OriginalFilename),
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
			logger.Get().Error("encode failed", zap.Int32("video_id", r.VideoID), zap.Error(r.Error))
			m.queries.UpdateVideoStatus(ctx, db.UpdateVideoStatusParams{
				ID:           r.VideoID,
				Status:       "failed",
				ErrorMessage: pgtype.Text{String: r.Error.Error(), Valid: true},
			})
		}
	}

	var totalOriginalSize, totalOptimizedSize int64
	var processedCount int32
	for _, r := range results {
		if r.Success {
			totalOriginalSize += r.OriginalSize
			totalOptimizedSize += r.OptimizedSize
			processedCount++
		}
	}

	// 6. update batch record
	m.queries.UpdateBatchProgress(ctx, db.UpdateBatchProgressParams{
		ID:                 batch.ID,
		ProcessedFiles:     processedCount,
		TotalOriginalSize:  totalOriginalSize,
		TotalOptimizedSize: totalOptimizedSize,
	})

	return m.GetBatchReport(ctx, batch.ID)
}

func (m *Manager) GetBatchReport(ctx context.Context, batchID int32) (*Report, error) {
	// 1. fetch the batch + videos
	batch, err := m.queries.GetBatch(ctx, batchID)
	if err != nil {
		logger.Get().Error("failed to get batch", zap.Int32("batch_id", batchID), zap.Error(err))
		return nil, err
	}

	videos, err := m.queries.GetVideosByBatch(ctx, batchID)
	if err != nil {
		logger.Get().Error("failed to get videos for batch", zap.Int32("batch_id", batchID), zap.Error(err))
		return nil, err
	}

	var failedCount int32
	var videosResults []VideoResult
	for _, v := range videos {
		if v.Status == "failed" {
			failedCount++
		}
		videosResults = append(videosResults, VideoResult{
			VideoID:       v.ID,
			Filename:      v.OriginalFilename,
			OriginalSize:  v.OriginalSize,
			OptimizedSize: v.OptimizedSize.Int64,
			Status:        v.Status,
		})
	}

	// 2. count fail,compute ratio and duraiton
	var ratio float64
	if batch.TotalOriginalSize > 0 {
		ratio = float64(batch.TotalOptimizedSize) / float64(batch.TotalOriginalSize)
	}
	duration := batch.UpdatedAt.Time.Sub(batch.CreatedAt.Time)

	// 3. return report
	return &Report{
		BatchID:            batch.ID,
		Status:             batch.Status,
		TotalFiles:         batch.TotalFiles,
		ProcessedFiles:     batch.ProcessedFiles,
		FailedCount:        failedCount,
		TotalOriginalSize:  batch.TotalOriginalSize,
		TotalOptimizedSize: batch.TotalOptimizedSize,
		CompressionRatio:   ratio,
		Duration:           duration,
		Videos:             videosResults,
	}, nil
}
