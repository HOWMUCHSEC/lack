package scanner

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"lack-client/pkg/logger"
	testapi "lack-client/pkg/targets/testapi"
	"lack-client/pkg/utils"

	"github.com/getsentry/sentry-go"
)

var doAPITest = testapi.DoTest

const (
	DefaultRunConcurrency     = 10
	MaxRunSamples             = 10000
	MaxRunConcurrency         = 100
	MaxRunRetryAttempts       = 5
	MaxRunPerAttemptTimeoutMs = 120000
	MaxRunBackoffMs           = 60000
	MaxRunRequestBodyBytes    = 1 << 20
	MaxRunRequestHeaderBytes  = 64 << 10
	MaxRunRequestURLBytes     = 8 << 10
	MaxRunRequestMethodBytes  = 32
	MaxRunFieldPathBytes      = 512
	MaxRunVariables           = 256
	MaxRunVariableKeyBytes    = 128
	MaxRunVariableValueBytes  = 16 << 10
	MaxRunSamplePromptBytes   = 256 << 10
	MaxRunSampleMetaBytes     = 64 << 10
	MaxRunStatusRules         = 64
	MaxRunStatusRuleBytes     = 64
	MaxRunAbortAfterFailures  = 10000
)

// RetryPolicy controls retry and timeout/backoff.
type RetryPolicy struct {
	MaxAttempts         int `json:"maxAttempts"`         // Extra retries (Total attempts = 1 + MaxAttempts)
	PerAttemptTimeoutMs int `json:"perAttemptTimeoutMs"` // Timeout per attempt
	BaseBackoffMs       int `json:"baseBackoffMs"`
	MaxBackoffMs        int `json:"maxBackoffMs"`
	JitterPct           int `json:"jitterPct"` // 0-100
}

// StatusPolicy controls status code classification.
// Rules use string expressions: "200-299", "429", "500-599"
// Priority: ExpectedSuccess > RetryOn > FailOn
// If none match, considered Fail.
type StatusPolicy struct {
	ExpectedSuccess []string `json:"expectedSuccess"`
	RetryOn         []string `json:"retryOn"`
	FailOn          []string `json:"failOn"`
}

// RequestSpec describes the request template to be executed (interpolated before call).
// HeadersJSON/BodyJSON passed as JSON strings.
type RequestSpec struct {
	BaseURL       string `json:"baseURL"`
	Method        string `json:"method"`
	HeadersJSON   string `json:"headersJSON"`
	BodyJSON      string `json:"bodyJSON"`
	RequestField  string `json:"requestField"`  // Field path in request body to insert sample
	ResponseField string `json:"responseField"` // Field path in response body to extract result
}

// Sample represents a single sample.
type Sample struct {
	ID     string         `json:"id"`
	Prompt string         `json:"prompt"`
	Meta   map[string]any `json:"meta,omitempty"`
}

// RunConfig is the configuration for a single run.
type RunConfig struct {
	TaskID             string            `json:"taskID"`
	Concurrency        int               `json:"concurrency"` // Concurrency level, default 10
	AbortAfterFailures int               `json:"abortAfterFailures"`
	Retry              RetryPolicy       `json:"retry"`
	Status             StatusPolicy      `json:"status"`
	Variables          map[string]string `json:"variables"`
	Request            RequestSpec       `json:"request"`
	Samples            []Sample          `json:"samples"`
}

// StepResult is the result of each step (a specific attempt for a sample).
type StepResult struct {
	RunID        string            `json:"runID"`
	TaskID       string            `json:"taskID"`
	SampleID     string            `json:"sampleID"`
	Attempt      int               `json:"attempt"`
	StatusCode   int               `json:"statusCode"`
	Success      bool              `json:"success"`
	DurationMs   int64             `json:"durationMs"`
	Error        string            `json:"error"`
	Headers      map[string]string `json:"headers"`
	ReqPreview   string            `json:"reqPreview"`
	RespPreview  string            `json:"respPreview"`
	FinalRequest RequestSpec       `json:"finalRequest"`
	ResponseBody string            `json:"responseBody"`
}

// RunResult summary.
type RunResult struct {
	RunID      string `json:"runID"`
	TaskID     string `json:"taskID"`
	StartedAt  int64  `json:"startedAt"`
	FinishedAt int64  `json:"finishedAt"`
	Total      int    `json:"total"`
	Ok         int    `json:"ok"`
	Failed     int    `json:"failed"`
	Aborted    bool   `json:"aborted"`
}

// Callbacks runtime callbacks.
type Callbacks struct {
	OnStarted  func(runID string, total int)
	OnStep     func(step StepResult)
	OnFinished func(summary RunResult)
}

func NormalizeRunConfig(cfg RunConfig) (RunConfig, error) {
	if len(cfg.Samples) > MaxRunSamples {
		return cfg, fmt.Errorf("too many samples: got %d, max %d", len(cfg.Samples), MaxRunSamples)
	}
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = DefaultRunConcurrency
	}
	if cfg.Concurrency > MaxRunConcurrency {
		return cfg, fmt.Errorf("concurrency exceeds hard limit: got %d, max %d", cfg.Concurrency, MaxRunConcurrency)
	}
	if cfg.Retry.MaxAttempts < 0 {
		cfg.Retry.MaxAttempts = 0
	}
	if cfg.Retry.MaxAttempts > MaxRunRetryAttempts {
		return cfg, fmt.Errorf("retry attempts exceed hard limit: got %d, max %d", cfg.Retry.MaxAttempts, MaxRunRetryAttempts)
	}
	if cfg.Retry.PerAttemptTimeoutMs <= 0 {
		cfg.Retry.PerAttemptTimeoutMs = 8000
	}
	if cfg.Retry.PerAttemptTimeoutMs > MaxRunPerAttemptTimeoutMs {
		return cfg, fmt.Errorf("per-attempt timeout exceeds hard limit: got %dms, max %dms", cfg.Retry.PerAttemptTimeoutMs, MaxRunPerAttemptTimeoutMs)
	}
	if cfg.Retry.BaseBackoffMs < 0 {
		cfg.Retry.BaseBackoffMs = 0
	}
	if cfg.Retry.BaseBackoffMs > MaxRunBackoffMs {
		return cfg, fmt.Errorf("base backoff exceeds hard limit: got %dms, max %dms", cfg.Retry.BaseBackoffMs, MaxRunBackoffMs)
	}
	if cfg.Retry.MaxBackoffMs < 0 {
		cfg.Retry.MaxBackoffMs = 0
	}
	if cfg.Retry.MaxBackoffMs > MaxRunBackoffMs {
		return cfg, fmt.Errorf("max backoff exceeds hard limit: got %dms, max %dms", cfg.Retry.MaxBackoffMs, MaxRunBackoffMs)
	}
	if cfg.Retry.JitterPct < 0 || cfg.Retry.JitterPct > 100 {
		return cfg, fmt.Errorf("jitter percentage must be between 0 and 100")
	}
	if cfg.AbortAfterFailures < 0 {
		cfg.AbortAfterFailures = 0
	}
	if cfg.AbortAfterFailures > MaxRunAbortAfterFailures {
		return cfg, fmt.Errorf("abort-after-failures exceeds hard limit: got %d, max %d", cfg.AbortAfterFailures, MaxRunAbortAfterFailures)
	}
	if err := validateRunVariables(cfg.Variables); err != nil {
		return cfg, err
	}
	if err := validateRunSamples(cfg.Samples); err != nil {
		return cfg, err
	}
	if err := validateStatusPolicy(cfg.Status); err != nil {
		return cfg, err
	}
	if err := validateRequestSpecSize(cfg.Request); err != nil {
		return cfg, err
	}
	return cfg, nil
}

func validateRunVariables(variables map[string]string) error {
	if len(variables) > MaxRunVariables {
		return fmt.Errorf("too many variables: got %d, max %d", len(variables), MaxRunVariables)
	}
	for key, value := range variables {
		if len(key) > MaxRunVariableKeyBytes {
			return fmt.Errorf("variable key exceeds hard limit: got %d bytes, max %d", len(key), MaxRunVariableKeyBytes)
		}
		if len(value) > MaxRunVariableValueBytes {
			return fmt.Errorf("variable %q exceeds hard limit: got %d bytes, max %d", key, len(value), MaxRunVariableValueBytes)
		}
	}
	return nil
}

func validateRunSamples(samples []Sample) error {
	for _, sample := range samples {
		if len(sample.Prompt) > MaxRunSamplePromptBytes {
			return fmt.Errorf("sample %q prompt exceeds hard limit: got %d bytes, max %d", sample.ID, len(sample.Prompt), MaxRunSamplePromptBytes)
		}
		if sample.Meta != nil {
			metaBytes, err := json.Marshal(sample.Meta)
			if err != nil {
				return fmt.Errorf("sample %q metadata must be JSON-serializable: %w", sample.ID, err)
			}
			if len(metaBytes) > MaxRunSampleMetaBytes {
				return fmt.Errorf("sample %q metadata exceeds hard limit: got %d bytes, max %d", sample.ID, len(metaBytes), MaxRunSampleMetaBytes)
			}
		}
	}
	return nil
}

func validateStatusPolicy(status StatusPolicy) error {
	if err := validateStatusRules("expectedSuccess", status.ExpectedSuccess); err != nil {
		return err
	}
	if err := validateStatusRules("retryOn", status.RetryOn); err != nil {
		return err
	}
	return validateStatusRules("failOn", status.FailOn)
}

func validateStatusRules(name string, rules []string) error {
	if len(rules) > MaxRunStatusRules {
		return fmt.Errorf("status policy %s has too many rules: got %d, max %d", name, len(rules), MaxRunStatusRules)
	}
	for _, rule := range rules {
		if len(rule) > MaxRunStatusRuleBytes {
			return fmt.Errorf("status policy %s rule exceeds hard limit: got %d bytes, max %d", name, len(rule), MaxRunStatusRuleBytes)
		}
	}
	return nil
}

func validateRequestSpecSize(request RequestSpec) error {
	if len(request.BaseURL) > MaxRunRequestURLBytes {
		return fmt.Errorf("request URL exceeds hard limit: got %d bytes, max %d", len(request.BaseURL), MaxRunRequestURLBytes)
	}
	if len(request.Method) > MaxRunRequestMethodBytes {
		return fmt.Errorf("request method exceeds hard limit: got %d bytes, max %d", len(request.Method), MaxRunRequestMethodBytes)
	}
	if len(request.BodyJSON) > MaxRunRequestBodyBytes {
		return fmt.Errorf("request body exceeds hard limit: got %d bytes, max %d", len(request.BodyJSON), MaxRunRequestBodyBytes)
	}
	if len(request.HeadersJSON) > MaxRunRequestHeaderBytes {
		return fmt.Errorf("request headers exceed hard limit: got %d bytes, max %d", len(request.HeadersJSON), MaxRunRequestHeaderBytes)
	}
	if len(request.RequestField) > MaxRunFieldPathBytes {
		return fmt.Errorf("request field path exceeds hard limit: got %d bytes, max %d", len(request.RequestField), MaxRunFieldPathBytes)
	}
	if len(request.ResponseField) > MaxRunFieldPathBytes {
		return fmt.Errorf("response field path exceeds hard limit: got %d bytes, max %d", len(request.ResponseField), MaxRunFieldPathBytes)
	}
	return nil
}

func previewString(value string, max int) string {
	if max <= 0 || len(value) <= max {
		return value
	}
	return value[:max] + "..."
}

func matchStatus(patterns []string, code int) bool {
	for _, p := range patterns {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if strings.Contains(p, "-") {
			seg := strings.SplitN(p, "-", 2)
			lo, err1 := strconv.Atoi(strings.TrimSpace(seg[0]))
			hi, err2 := strconv.Atoi(strings.TrimSpace(seg[1]))
			if err1 == nil && err2 == nil {
				if code >= lo && code <= hi {
					return true
				}
			}
		} else {
			k, err := strconv.Atoi(p)
			if err == nil && code == k {
				return true
			}
		}
	}
	return false
}

func isStepSuccess(respSuccess bool, status StatusPolicy, code int) bool {
	if len(status.ExpectedSuccess) > 0 {
		return matchStatus(status.ExpectedSuccess, code)
	}
	return respSuccess
}

func backoffDuration(baseMs, maxMs, jitterPct, attempt int) time.Duration {
	if baseMs <= 0 {
		baseMs = 100
	}
	if maxMs <= 0 {
		maxMs = baseMs * 10
	}
	// Exponential backoff: base * 2^(attempt-1)
	exp := baseMs
	for i := 1; i < attempt; i++ {
		exp *= 2
		if exp > maxMs {
			exp = maxMs
			break
		}
	}
	if jitterPct > 0 {
		j := float64(jitterPct) / 100.0
		jitter := int(float64(exp) * j * (rand.Float64()*2 - 1)) // [-j, +j]
		exp = exp + jitter
		if exp < baseMs {
			exp = baseMs
		}
	}
	return time.Duration(exp) * time.Millisecond
}

// injectSampleIntoBody inserts sample content into the specified field path of the request body.
func injectSampleIntoBody(bodyJSON, requestField, samplePrompt string) (string, error) {
	requestField = strings.TrimSpace(requestField)
	if requestField == "" {
		return bodyJSON, nil
	}
	if strings.TrimSpace(bodyJSON) == "" {
		return bodyJSON, fmt.Errorf("request field %q is configured but request body is empty", requestField)
	}

	// Parse JSON
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(bodyJSON), &data); err != nil {
		return bodyJSON, fmt.Errorf("failed to parse body JSON: %w", err)
	}
	if data == nil {
		return bodyJSON, fmt.Errorf("request body must be a JSON object")
	}

	// Simplified path parsing and setting
	// Supports: "prompt", "messages[0].content", "data.input"
	normalizedPath := utils.ArrayIndexRe.ReplaceAllString(requestField, ".$1")
	parts := strings.Split(normalizedPath, ".")

	if err := setNestedValue(data, parts, samplePrompt); err != nil {
		return bodyJSON, err
	}

	// Re-marshal
	result, err := json.Marshal(data)
	if err != nil {
		return bodyJSON, fmt.Errorf("failed to marshal body JSON: %w", err)
	}

	return string(result), nil
}

// setNestedValue recursively sets a nested value.
func setNestedValue(data map[string]interface{}, parts []string, value interface{}) error {
	if len(parts) == 0 {
		return nil
	}

	part := parts[0]

	if len(parts) == 1 {
		// Last part
		if _, err := strconv.Atoi(part); err == nil {
			// Array index - but unlikely at top level
			return fmt.Errorf("cannot set array index at top level")
		} else {
			data[part] = value
		}
		return nil
	}

	// More parts remaining
	nextPart := parts[1]

	// Check if next part is an array index
	if idx, err := strconv.Atoi(nextPart); err == nil {
		// Next is array index, ensure current part is array
		arr, ok := data[part].([]interface{})
		if !ok {
			return fmt.Errorf("field %s is not an array", part)
		}
		if idx < 0 || idx >= len(arr) {
			return fmt.Errorf("array index %d out of bounds for field %s", idx, part)
		}

		if len(parts) == 2 {
			// Set array element directly
			arr[idx] = value
		} else {
			// Continue deep into array element
			if elem, ok := arr[idx].(map[string]interface{}); ok {
				return setNestedValue(elem, parts[2:], value)
			} else {
				return fmt.Errorf("array element at index %d is not an object", idx)
			}
		}
		return nil
	}

	// Next is not array index, continue deep into object
	next, ok := data[part].(map[string]interface{})
	if !ok {
		// Create intermediate object
		next = make(map[string]interface{})
		data[part] = next
	}
	return setNestedValue(next, parts[1:], value)
}

// Start starts a scan (asynchronous), returns runID immediately.
func Start(ctx context.Context, cfg RunConfig, cb Callbacks) (string, error) {
	normalizedCfg, err := NormalizeRunConfig(cfg)
	if err != nil {
		return "", err
	}
	cfg = normalizedCfg
	runID := fmt.Sprintf("run-%d", time.Now().UnixNano())
	samples := cfg.Samples
	total := len(samples)
	concurrency := cfg.Concurrency

	go func() {
		started := time.Now().UnixMilli()
		defer func() {
			if r := recover(); r != nil {
				logger.Error("scanner goroutine panic recovered", "runID", runID, "error", r, "stack", string(debug.Stack()))
				sentry.CurrentHub().Recover(r)
				sentry.Flush(2 * time.Second)
				// Call OnFinished even after panic recovery to avoid frontend freeze
				if cb.OnFinished != nil {
					cb.OnFinished(RunResult{
						RunID:      runID,
						TaskID:     cfg.TaskID,
						StartedAt:  started,
						FinishedAt: time.Now().UnixMilli(),
						Total:      total,
						Aborted:    true,
					})
				}
			}
		}()
		if cb.OnStarted != nil {
			cb.OnStarted(runID, total)
		}

		var okCount int32
		var failedCount int32
		var aborted int32 // 0=running, 1=aborted

		var wg sync.WaitGroup
		sem := make(chan struct{}, concurrency)

	sampleLoop:
		for _, s := range samples {
			// Check if aborted
			if atomic.LoadInt32(&aborted) == 1 {
				break sampleLoop
			}
			select {
			case <-ctx.Done():
				atomic.StoreInt32(&aborted, 1)
				break sampleLoop
			default:
			}

			wg.Add(1)
			sem <- struct{}{} // Acquire semaphore

			go func(sample Sample) {
				defer wg.Done()
				defer func() { <-sem }() // Release semaphore
				defer func() {
					if r := recover(); r != nil {
						logger.Error("sample goroutine panic recovered", "runID", runID, "sampleID", sample.ID, "error", r)
						sentry.CurrentHub().Recover(r)
						atomic.AddInt32(&failedCount, 1)
					}
				}()

				processSample(ctx, runID, cfg, sample, cb, &okCount, &failedCount, &aborted)
			}(s)
		}

		wg.Wait()

		summary := RunResult{
			RunID:      runID,
			TaskID:     cfg.TaskID,
			StartedAt:  started,
			FinishedAt: time.Now().UnixMilli(),
			Total:      total,
			Ok:         int(atomic.LoadInt32(&okCount)),
			Failed:     int(atomic.LoadInt32(&failedCount)),
			Aborted:    atomic.LoadInt32(&aborted) == 1,
		}
		if cb.OnFinished != nil {
			cb.OnFinished(summary)
		}
	}()

	return runID, nil
}

// processSample processes a single sample (concurrency safe).
func processSample(
	ctx context.Context,
	runID string,
	cfg RunConfig,
	s Sample,
	cb Callbacks,
	okCount, failedCount, aborted *int32,
) {
	// Check if aborted
	if atomic.LoadInt32(aborted) == 1 {
		return
	}

	// Attempts: 1st try + MaxAttempts retries
	attempts := 1
	if cfg.Retry.MaxAttempts > 0 {
		attempts += cfg.Retry.MaxAttempts
	}

	var lastErr string
	var stepStatus int
	var stepSuccess bool
	var stepDuration int64
	var stepHeaders map[string]string
	var reqPreview, respPreview string
	var finalReq RequestSpec
	var respBodyFull string

	var backoffTimer *time.Timer
	defer func() {
		if backoffTimer != nil {
			backoffTimer.Stop()
		}
	}()

	for a := 1; a <= attempts; a++ {
		// Check cancellation and abort
		select {
		case <-ctx.Done():
			atomic.StoreInt32(aborted, 1)
			return
		default:
		}
		if atomic.LoadInt32(aborted) == 1 {
			return
		}

		// Interpolation
		vars := cfg.Variables
		baseURL := utils.Interpolate(cfg.Request.BaseURL, vars)
		method := utils.Interpolate(cfg.Request.Method, vars)
		headersJSON := utils.Interpolate(cfg.Request.HeadersJSON, vars)
		bodyJSON := utils.Interpolate(cfg.Request.BodyJSON, vars)
		finalReq = RequestSpec{
			BaseURL:       baseURL,
			Method:        method,
			HeadersJSON:   headersJSON,
			BodyJSON:      bodyJSON,
			RequestField:  cfg.Request.RequestField,
			ResponseField: cfg.Request.ResponseField,
		}

		// Inject sample into specified field path of request body
		if cfg.Request.RequestField != "" {
			injectedBody, injectErr := injectSampleIntoBody(bodyJSON, cfg.Request.RequestField, s.Prompt)
			if injectErr != nil {
				lastErr = fmt.Sprintf("failed to inject sample into request body: %v", injectErr)
				logger.Warn("failed to inject sample into body", "sampleID", s.ID, "requestField", cfg.Request.RequestField, "error", injectErr)
				reqPreview = previewString(bodyJSON, 1000)
				if cb.OnStep != nil {
					cb.OnStep(StepResult{
						RunID:        runID,
						TaskID:       cfg.TaskID,
						SampleID:     s.ID,
						Attempt:      a,
						StatusCode:   0,
						Success:      false,
						DurationMs:   0,
						Error:        lastErr,
						Headers:      nil,
						ReqPreview:   reqPreview,
						RespPreview:  "",
						FinalRequest: finalReq,
						ResponseBody: "",
					})
				}
				newFailed := atomic.AddInt32(failedCount, 1)
				if cfg.AbortAfterFailures > 0 && int(newFailed) >= cfg.AbortAfterFailures {
					atomic.StoreInt32(aborted, 1)
				}
				return
			} else {
				bodyJSON = injectedBody
				finalReq.BodyJSON = injectedBody
			}
		}

		if sizeErr := validateRequestSpecSize(finalReq); sizeErr != nil {
			lastErr = sizeErr.Error()
			reqPreview = previewString(bodyJSON, 1000)
			if cb.OnStep != nil {
				cb.OnStep(StepResult{
					RunID:        runID,
					TaskID:       cfg.TaskID,
					SampleID:     s.ID,
					Attempt:      a,
					StatusCode:   0,
					Success:      false,
					DurationMs:   0,
					Error:        lastErr,
					Headers:      nil,
					ReqPreview:   reqPreview,
					RespPreview:  "",
					FinalRequest: finalReq,
					ResponseBody: "",
				})
			}
			newFailed := atomic.AddInt32(failedCount, 1)
			if cfg.AbortAfterFailures > 0 && int(newFailed) >= cfg.AbortAfterFailures {
				atomic.StoreInt32(aborted, 1)
			}
			return
		}

		// Assemble request
		timeoutMs := cfg.Retry.PerAttemptTimeoutMs
		if timeoutMs <= 0 {
			timeoutMs = 8000
		}
		req := testapi.Request{
			BaseURL:        baseURL,
			RequestHeaders: headersJSON,
			RequestBody:    bodyJSON,
			Method:         method,
			TimeoutMs:      timeoutMs,
		}
		// Preview
		reqPreview = previewString(bodyJSON, 1000)

		t0 := time.Now()
		resp := doAPITest(ctx, req)
		stepDuration = time.Since(t0).Milliseconds()

		stepStatus = resp.StatusCode
		stepSuccess = isStepSuccess(resp.Success, cfg.Status, stepStatus)
		if resp.Error != "" {
			lastErr = resp.Error
		} else {
			lastErr = ""
		}
		stepHeaders = resp.Headers
		respBodyFull = resp.ResponseBody

		respPreview = previewString(resp.ResponseBody, 2000)

		// Report one attempt
		if cb.OnStep != nil {
			cb.OnStep(StepResult{
				RunID:        runID,
				TaskID:       cfg.TaskID,
				SampleID:     s.ID,
				Attempt:      a,
				StatusCode:   stepStatus,
				Success:      stepSuccess,
				DurationMs:   stepDuration,
				Error:        lastErr,
				Headers:      stepHeaders,
				ReqPreview:   reqPreview,
				RespPreview:  respPreview,
				FinalRequest: finalReq,
				ResponseBody: respBodyFull,
			})
		}

		// End condition
		if stepSuccess {
			atomic.AddInt32(okCount, 1)
			return
		}

		// Classification: Immediate Fail vs Retry vs Other Fail
		if matchStatus(cfg.Status.FailOn, stepStatus) {
			// Immediate fail, no retry
			newFailed := atomic.AddInt32(failedCount, 1)
			if cfg.AbortAfterFailures > 0 && int(newFailed) >= cfg.AbortAfterFailures {
				atomic.StoreInt32(aborted, 1)
			}
			return
		}

		if matchStatus(cfg.Status.RetryOn, stepStatus) || resp.Error != "" || stepStatus == 0 {
			if a < attempts {
				// Retry backoff
				bo := backoffDuration(cfg.Retry.BaseBackoffMs, cfg.Retry.MaxBackoffMs, cfg.Retry.JitterPct, a)
				if bo > 0 {
					if backoffTimer == nil {
						backoffTimer = time.NewTimer(bo)
					} else {
						if !backoffTimer.Stop() {
							select {
							case <-backoffTimer.C:
							default:
							}
						}
						backoffTimer.Reset(bo)
					}
					select {
					case <-ctx.Done():
						if backoffTimer != nil {
							backoffTimer.Stop()
						}
						atomic.StoreInt32(aborted, 1)
						return
					case <-backoffTimer.C:
					}
				} else {
					select {
					case <-ctx.Done():
						atomic.StoreInt32(aborted, 1)
						return
					default:
					}
				}
			} else {
				// Reached max attempts
				newFailed := atomic.AddInt32(failedCount, 1)
				if cfg.AbortAfterFailures > 0 && int(newFailed) >= cfg.AbortAfterFailures {
					atomic.StoreInt32(aborted, 1)
				}
				return
			}
			// Continue to next attempt
			continue
		}

		// Not matched any classification but failed: treat as Immediate Fail
		newFailed := atomic.AddInt32(failedCount, 1)
		if cfg.AbortAfterFailures > 0 && int(newFailed) >= cfg.AbortAfterFailures {
			atomic.StoreInt32(aborted, 1)
		}
		return
	}
}
