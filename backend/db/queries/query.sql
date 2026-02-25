-- name: GetVideo :one
SELECT * FROM videos
WHERE id = $1;