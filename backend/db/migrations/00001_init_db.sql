-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS batches (
  id SERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS batches;
-- +goose StatementEnd
