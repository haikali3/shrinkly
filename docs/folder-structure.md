shrinkly/
  ├── cmd/
  │   └── server/
  │       └── main.go              # Entry point
  ├── internal/
  │   ├── api/
  │   │   ├── handler.go           # HTTP handlers (batch submit, status)
  │   │   ├── router.go            # Route setup
  │   │   └── middleware.go        # Logging, recovery, etc.
  │   ├── job/
  │   │   ├── manager.go           # Batch/job lifecycle management
  │   │   └── model.go             # Batch & Video structs
  │   ├── worker/
  │   │   ├── pool.go              # Worker pool with concurrency limits
  │   │   └── encoder.go           # FFmpeg execution logic
  │   ├── storage/
  │   │   └── storage.go           # File storage (local disk / S3)
  │   └── db/
  │       ├── migrations/
  │       │   └── 001_init.sql             # Batch + Video tables
  │       ├── db.go                # DB connection setup
  │       ├── batch.go             # Batch table queries
  │       └── video.go             # Video table queries
  ├── config/
  │   └── config.go                # App config (concurrency, CRF, paths)
  ├── docs/
  │   └── prd.md
  ├── Dockerfile
  ├── docker-compose.yml           # App + PostgreSQL + FFmpeg
  └── bin/
      └── run                   # run script for local development