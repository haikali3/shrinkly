package worker

type Pool struct {
	workerCount int
	maxWorkers  int
}

func NewPool(workerCount, maxWorkers int) *Pool {
	return &Pool{
		workerCount: workerCount,
		maxWorkers:  maxWorkers,
	}
}

func Process()
