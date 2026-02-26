<!-- 3. internal/worker/

encoder.go
- Encode(inputPath, outputPath string, cfg *config.Config) (*Result, error)
- Builds & runs: ffmpeg -i input -c:v libx265 -preset medium -crf 26 -c:a aac -b:a 128k output
- Returns Result{OriginalSize, OptimizedSize}

pool.go
- NewPool(maxWorkers int) *Pool
- Pool.Process(tasks []Task) []TaskResult
- Uses a semaphore channel to limit concurrency

4. db/queries/

batch.sql
- CreateBatch, GetBatch, UpdateBatchStatus, UpdateBatchProgress

video.sql
- CreateVideo, GetVideo, GetVideosByBatch, UpdateVideoStatus, UpdateVideoSizes

5. internal/job/

manager.go
- CreateBatch(filePaths []string) (*Batch, error) — insert batch + videos into DB, kick off workers
- GetBatchReport(batchID) (*Report, error) — total sizes, compression ratio, failed count, duration -->

6. internal/api/

handler.go
- POST /batches — accept file uploads, call job manager
- GET /batches/:id — return batch status + report

router.go
- Wire routes to handlers

7. cmd/main.go

- Load config
- Connect to DB
- Init job manager + worker pool
- Start HTTP server
