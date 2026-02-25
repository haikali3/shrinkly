-- name: CreateVideo :one
INSERT INTO videos (
  batch_id, original_filename, original_size, status
) VALUES (
  $1, $2, $3, $4
)
RETURNING *;

-- name: GetVideo :one
SELECT * FROM videos
WHERE id = $1;

-- name: GetVideosByBatch :many
SELECT * FROM videos
WHERE batch_id = $1;

-- name: UpdateVideoStatus :exec
UPDATE videos
SET status = $1, error_message = $2, updated_at = NOW()
WHERE id = $3;

-- name: UpdateVideoSizes :exec
UPDATE videos
SET optimized_filename = $1, optimized_size = $2, status = $3, updated_at = NOW()
WHERE id = $4;