-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS batches (
  id SERIAL PRIMARY KEY,
  total_files INT NOT NULL,
  processed_files INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  total_original_size BIGINT NOT NULL DEFAULT 0,
  total_optimized_size BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL,
  duration_seconds INT,
  compression_ratio FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  batch_id INT NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  optimized_filename VARCHAR(255),
  original_size BIGINT NOT NULL,
  optimized_size BIGINT,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS videos;
DROP TABLE IF EXISTS batches;
-- +goose StatementEnd
