package main

import (
	"fmt"
	"sync"
)

func addByTwoAtIndex(idx int, val int) (int, int) {
	val = val + 2
	return idx, val
}

func addSliceofNumberbyTwo(nums []int) []int {
	result := make([]int, len(nums))
	var wg sync.WaitGroup

	for i, num := range nums {
		wg.Add(1)
		go func(idx, val int) {
			defer wg.Done()
			outIdx, outVal := addByTwoAtIndex(idx, val)
			result[outIdx] = outVal
		}(i, num)
	}
	wg.Wait()
	return result
}

func main() {
	sliceOfNumber := []int{1, 2, 3, 4, 5} // dynamic length of array
	updated := addSliceofNumberbyTwo(sliceOfNumber)
	fmt.Println("original slice:", sliceOfNumber)
	fmt.Println("Updated slice:", updated)
}
