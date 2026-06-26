package scanner

import (
	"context"
	"strings"
	"sync/atomic"
	"testing"

	testapi "lack-client/pkg/targets/testapi"
)

func TestProcessSampleDoesNotSendRequestWhenInjectionFails(t *testing.T) {
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
		Request: RequestSpec{
			BaseURL:      "http://127.0.0.1:1",
			Method:       "POST",
			HeadersJSON:  `{}`,
			BodyJSON:     `{"messages":[]}`,
			RequestField: "messages[0].content",
		},
	}

	processSample(context.Background(), "run-1", cfg, Sample{ID: "sample-1", Prompt: "hello"}, Callbacks{
		OnStep: func(step StepResult) {
			steps = append(steps, step)
		},
	}, &ok, &failed, &aborted)

	if got := atomic.LoadInt32(&failed); got != 1 {
		t.Fatalf("expected failed count 1, got %d", got)
	}
	if len(steps) != 1 {
		t.Fatalf("expected one failed step, got %d", len(steps))
	}
	if steps[0].Success {
		t.Fatal("expected failed step")
	}
	if !strings.Contains(steps[0].Error, "failed to inject sample") {
		t.Fatalf("expected injection error to be surfaced, got %q", steps[0].Error)
	}
	if got := atomic.LoadInt32(&hits); got != 0 {
		t.Fatalf("expected no HTTP requests after injection failure, got %d", got)
	}
}

func TestProcessSampleDoesNotSendEmptyBodyWhenRequestFieldConfigured(t *testing.T) {
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
		Request: RequestSpec{
			BaseURL:      "http://127.0.0.1:1",
			Method:       "POST",
			HeadersJSON:  `{}`,
			BodyJSON:     ``,
			RequestField: "prompt",
		},
	}

	processSample(context.Background(), "run-1", cfg, Sample{ID: "sample-1", Prompt: "hello"}, Callbacks{
		OnStep: func(step StepResult) {
			steps = append(steps, step)
		},
	}, &ok, &failed, &aborted)

	if got := atomic.LoadInt32(&failed); got != 1 {
		t.Fatalf("expected failed count 1, got %d", got)
	}
	if got := atomic.LoadInt32(&ok); got != 0 {
		t.Fatalf("expected ok count 0, got %d", got)
	}
	if len(steps) != 1 {
		t.Fatalf("expected one failed step, got %d", len(steps))
	}
	if !strings.Contains(steps[0].Error, "request body is empty") {
		t.Fatalf("expected empty-body injection error, got %q", steps[0].Error)
	}
	if got := atomic.LoadInt32(&hits); got != 0 {
		t.Fatalf("expected no HTTP requests after empty-body injection failure, got %d", got)
	}
}
