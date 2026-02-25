# PRD

## Bulk Video Minimizer Microservice

Reduce Video Size in Bulk While Preserving Perceptual Quality

---

## 1. Overview

A backend service that processes large volumes of video files and reduces their size through efficient re encoding.

Primary objective:

Minimize storage footprint and bandwidth usage at scale while maintaining acceptable visual quality.

Target users:

* SaaS platforms storing user generated videos
* Media libraries with large archives
* Agencies managing bulk client media
* Internal data pipelines

---

## 2. Goal

Main goal:

Reduce total storage size of video collections in bulk.

Success metrics:

* Average size reduction 30 to 60 percent
* No visible quality degradation for typical web playback
* Stable processing under heavy batch loads
* Controlled CPU and memory usage

---

## 3. Scope MVP

### In Scope

* Batch video processing
* Automatic codec conversion H264 to H265
* CRF based compression
* Worker pool with concurrency limits
* Storage of optimized outputs
* Basic job tracking
* Compression reporting

### Out of Scope

* Real time streaming
* Video editing features
* AI scene detection
* GPU acceleration
* Distributed cluster in v1

---

## 4. Core Workflow

1. Bulk upload or directory ingestion
2. Create batch job record
3. Queue individual video tasks
4. Worker pool processes videos using FFmpeg
5. Store optimized versions
6. Generate batch report

---

## 5. Compression Strategy

Default behavior:

* Convert to H265
* Use CRF 26 to 28
* Preserve original resolution
* Normalize audio bitrate

Example internal command:

```bash
ffmpeg -i input.mp4 -c:v libx265 -preset medium -crf 28 -c:a aac -b:a 128k output.mp4
```

Optional mode:

* Re encode H264 using optimized CRF
* Strip metadata

---

## 6. System Design

### Components

API Layer
Handles batch submission and status queries

Job Manager
Tracks batch and per file progress

Worker Pool
Executes FFmpeg processes with concurrency limits

Storage
Local disk or S3 compatible object storage

---

## 7. Concurrency Control

Configurable max parallel encodes based on CPU.

Example:

4 vCPU machine
Max 2 parallel encodes

Prevents:

* CPU saturation
* Memory exhaustion
* Disk IO bottlenecks

---

## 8. Data Model

Batch table

* id
* total_files
* processed_files
* total_original_size
* total_optimized_size
* status

Video table

* id
* batch_id
* original_size
* optimized_size
* status
* error

---

## 9. Reporting

For each batch:

* Total original size
* Total optimized size
* Overall compression ratio
* Failed count
* Processing duration

---

## 10. Deployment

* Go service
* FFmpeg installed on VPS
* PostgreSQL
* Dockerized deployment
* Single node in v1

Recommended:

4 vCPU
8 GB RAM

---

## 11. Why This Project Is Strong

Demonstrates:

* CPU bound workload control
* Background processing design
* Bulk job orchestration
* File system and storage management
* Real world backend scaling considerations