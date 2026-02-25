-- name: GetVideo :one
SELECT
  *
FROM
  videos
WHERE
  id = $1;

-- name: CreateBatch :one
INSERT INTO batches(total_files, status)
  VALUES ($1, $2)
RETURNING
  *;

-- name: GetBatch :one
SELECT
  *
FROM
  batches
WHERE
  id = $1;

-- name: UpdateBatchStatus :exec
UPDATE
  batches
SET
  status = $1,
  updated_at = NOW()
WHERE
  id = $2;

-- name: UpdateBatchProgress :exec
UPDATE
  batches
SET
  processed_files = $1,
  total_original_size = $2,
  total_optimized_size = $3,
  updated_at = NOW()
WHERE
  id = $4;

