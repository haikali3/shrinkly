package worker

import (
	"shrinkly/backend/config"
	"sync"
)

type Pool struct {
	maxWorkers int
	cfg        *config.Config
}

type Task struct {
	VideoID    int32
	InputPath  string
	OutputPath string
}

type TaskResult struct {
	VideoID       int32
	Success       bool
	Error         error
	OriginalSize  int64
	OptimizedSize int64
}

func NewPool(maxWorkers int, cfg *config.Config) *Pool {
	return &Pool{
		maxWorkers: maxWorkers,
		cfg:        cfg,
	}
}

func (p *Pool) Process(tasks []Task) []TaskResult {
	// 1. take tasks []Task
	results := make([]TaskResult, len(tasks))

	if len(tasks) == 0 {
		return results
	}

	max := p.maxWorkers
	if max <= 0 {
		max = 1
	}

	// 2. run each task (encode/compress one video) in parallel
	slots := make(chan struct{}, max)

	var wg sync.WaitGroup
	// 3. limit parallel runs to maxWorkers using semaphore
	for i, task := range tasks {
		wg.Add(1)
		slots <- struct{}{}
		go func(idx int, t Task) {
			defer wg.Done()
			defer func() { <-slots }()

			origSize, optSize, err := Encode(t.InputPath, t.OutputPath, p.cfg)
			if err != nil {
				// 4. capture on TaskResult per task
				results[idx] = TaskResult{
					VideoID: t.VideoID,
					Success: false,
					Error:   err,
				}
				return
			}
			results[idx] = TaskResult{
				VideoID:       t.VideoID,
				Success:       true,
				OriginalSize:  origSize,
				OptimizedSize: optSize,
			}
		}(i, task)
	}
	wg.Wait()
	// 5. return all result

	return results
}
