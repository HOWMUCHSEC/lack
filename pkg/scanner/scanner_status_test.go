package scanner

import (
	"context"
	"sync/atomic"
	"testing"

	testapi "lack-client/pkg/targets/testapi"
)

func TestProcessSampleHonorsExpectedSuccessBeforeHTTP2xxSuccess(t *testing.T) {
	var hits int32
	oldDoAPITest := doAPITest
	doAPITest = func(context.Context, testapi.Request) testapi.Response {
		atomic.AddInt32(&hits, 1)
		return testapi.Response{Success: true, StatusCode: 200}
	}
	t.Cleanup(func() {
		doAPITest = oldDoAPITest
	})

	var failed int32
	var ok int32
	var aborted int32
	var steps []StepResult

	cfg := RunConfig{
		TaskID: "task-1",
		Retry: RetryPolicy{
			MaxAttempts:   1,
			BaseBackoffMs: 1,
			MaxBackoffMs:  1,
		},
		Status: StatusPolicy{
			ExpectedSuccess: []string{"201"},
			RetryOn:         []string{"200"},
		},
		Request: RequestSpec{
			BaseURL:     "http://127.0.0.1:1",
			Method:      "POST",
			HeadersJSON: `{}`,
			BodyJSON:    `{}`,
		},
	}

	processSample(context.Background(), "run-1", cfg, Sample{ID: "sample-1", Prompt: "hello"}, Callbacks{
		OnStep: func(step StepResult) {
			steps = append(steps, step)
		},
	}, &ok, &failed, &aborted)

	if got := atomic.LoadInt32(&hits); got != 2 {
		t.Fatalf("expected status 200 to be retried once, got %d requests", got)
	}
	if got := atomic.LoadInt32(&ok); got != 0 {
		t.Fatalf("expected ok count 0, got %d", got)
	}
	if got := atomic.LoadInt32(&failed); got != 1 {
		t.Fatalf("expected failed count 1 after retry exhaustion, got %d", got)
	}
	if len(steps) != 2 {
		t.Fatalf("expected two reported attempts, got %d", len(steps))
	}
	for _, step := range steps {
		if step.Success {
			t.Fatalf("expected status 200 not to be successful when expectedSuccess is 201, got %+v", step)
		}
	}
}
