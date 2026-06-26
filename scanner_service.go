package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"lack-client/pkg/config"
	"lack-client/pkg/logger"
	"lack-client/pkg/scanner"
	"lack-client/pkg/storage"
	"lack-client/pkg/utils"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const maxRunStepsListLimit = 500

// ScannerService provides scan control services exposed to the frontend via Wails bindings.
type ScannerService struct {
	ctx     context.Context               // Wails context for event emission
	mu      sync.Mutex                    // Concurrency control
	cancels map[string]context.CancelFunc // Manages scan cancel functions
}

// NewScannerService creates a new ScannerService instance.
func NewScannerService() *ScannerService {
	return &ScannerService{cancels: make(map[string]context.CancelFunc)}
}

// Startup initializes the service with the Wails context.
func (s *ScannerService) Startup(ctx context.Context) {
	s.ctx = ctx
}

// CountActiveRuns returns the number of currently active scan runs.
func (s *ScannerService) CountActiveRuns() (int, error) {
	return storage.CountByPrefix([]byte("scan:run:active:"))
}

// ListRecentRuns returns scan run summaries for all tasks, descending by timestamp (newest first).
// Uses global timestamp index scan:runs:ts:{ts}:{runID} for fast lookup.
func (s *ScannerService) ListRecentRuns(offset, limit int) ([]scanner.RunResult, error) {
	// Use global timestamp index
	prefix := "scan:runs:ts:"
	items, err := storage.ListByPrefix([]byte(prefix), 0, maxListLimit)
	if err != nil {
		return nil, err
	}

	// Badger returns keys in lexicographical order; timestamp is in the key, so reverse for descending.
	total := len(items)
	if offset < 0 {
		offset = 0
	}
	if offset >= total {
		return []scanner.RunResult{}, nil
	}

	// Traverse in reverse (newest at the end)
	start := total - offset - 1
	count := 0
	if limit <= 0 {
		limit = total
	}

	results := make([]scanner.RunResult, 0, limit)
	for i := start; i >= 0 && count < limit; i-- {
		runID := string(items[i].Value)
		if runID == "" {
			continue
		}
		metaKey := fmt.Sprintf("scan:run:%s:meta", runID)
		b, err := storage.Get([]byte(metaKey))
		if err != nil {
			continue
		}
		var rr scanner.RunResult
		if json.Unmarshal(b, &rr) == nil {
			results = append(results, rr)
			count++
		}
	}
	return results, nil
}

// updateTaskStatus updates the task status.
func (s *ScannerService) updateTaskStatus(taskID, status string) error {
	if taskID == "" {
		return nil
	}
	key := []byte("task:" + taskID)
	data, err := storage.Get(key)
	if err != nil {
		return err
	}
	var task map[string]any
	if err := json.Unmarshal(data, &task); err != nil {
		return err
	}
	task["status"] = status
	task["updated_at"] = time.Now().Format(time.RFC3339)
	newData, err := json.Marshal(task)
	if err != nil {
		return err
	}
	return storage.Put(key, newData)
}

// TaskStats holds task statistics.
type TaskStats struct {
	TaskID       string `json:"taskID"`
	TotalRuns    int    `json:"totalRuns"`
	LatestRunID  string `json:"latestRunID,omitempty"`
	TotalSamples int    `json:"totalSamples"`
	TotalOk      int    `json:"totalOk"`
	TotalFailed  int    `json:"totalFailed"`
	IsRunning    bool   `json:"isRunning"`
}

// GetTaskStats returns run statistics for a task.
func (s *ScannerService) GetTaskStats(taskID string) (*TaskStats, error) {
	stats := &TaskStats{TaskID: taskID}

	// 获取所有运行
	runs, err := s.ListTaskRuns(taskID, 0, 0)
	if err != nil {
		return stats, nil
	}

	stats.TotalRuns = len(runs)

	for _, run := range runs {
		stats.TotalSamples += run.Total
		stats.TotalOk += run.Ok
		stats.TotalFailed += run.Failed
	}

	// Get latest run
	if len(runs) > 0 {
		latest := runs[len(runs)-1]
		stats.LatestRunID = latest.RunID
	}

	// Check for active runs
	prefix := fmt.Sprintf("scan:task:%s:runs:", taskID)
	items, _ := storage.ListByPrefix([]byte(prefix), 0, maxListLimit)
	for _, it := range items {
		runID := string(it.Value)
		activeKey := fmt.Sprintf("scan:run:active:%s", runID)
		if _, err := storage.Get([]byte(activeKey)); err == nil {
			stats.IsRunning = true
			break
		}
	}

	return stats, nil
}

// StartScan asynchronously starts a scan and immediately returns the runID.
func (s *ScannerService) StartScan(cfg scanner.RunConfig) (string, error) {
	// Use centralized default values
	if cfg.Retry.MaxAttempts < 0 {
		cfg.Retry.MaxAttempts = 0
	}
	if cfg.Retry.PerAttemptTimeoutMs <= 0 {
		cfg.Retry.PerAttemptTimeoutMs = config.DefaultPerAttemptTimeoutMs
	}
	if cfg.Retry.BaseBackoffMs <= 0 {
		cfg.Retry.BaseBackoffMs = config.DefaultBaseBackoffMs
	}
	if cfg.Retry.MaxBackoffMs <= 0 {
		cfg.Retry.MaxBackoffMs = config.DefaultMaxBackoffMs
	}
	if cfg.Retry.JitterPct < 0 {
		cfg.Retry.JitterPct = config.DefaultJitterPct
	}
	if len(cfg.Status.ExpectedSuccess) == 0 {
		cfg.Status.ExpectedSuccess = config.DefaultExpectedSuccess
	}
	if len(cfg.Status.RetryOn) == 0 {
		cfg.Status.RetryOn = config.DefaultRetryOn
	}
	if len(cfg.Status.FailOn) == 0 {
		cfg.Status.FailOn = config.DefaultFailOn
	}
	if cfg.AbortAfterFailures < 0 {
		cfg.AbortAfterFailures = config.DefaultAbortAfterFailures
	}

	if s.ctx == nil {
		logger.Warn("ScannerService.StartScan: ctx is nil, using context.Background(). This may indicate Startup() was not called.")
	}
	baseCtx := utils.EnsureContext(s.ctx)
	ctx, cancel := context.WithCancel(baseCtx)

	var stepIdx int32 // Use atomic for concurrency safety

	runID, err := scanner.Start(ctx, cfg, scanner.Callbacks{
		OnStarted: func(runID string, total int) {
			defer func() {
				if r := recover(); r != nil {
					logger.Error("OnStarted callback panic", "runID", runID, "error", r)
					sentry.CurrentHub().Recover(r)
				}
			}()

			s.mu.Lock()
			s.cancels[runID] = cancel
			s.mu.Unlock()

			// Update task status to running
			if err := s.updateTaskStatus(cfg.TaskID, "running"); err != nil {
				logger.Warn("OnStarted: failed to update task status", "taskID", cfg.TaskID, "error", err)
			}

			// Index run by timestamp
			ts := time.Now().UnixMilli()
			idxKey := fmt.Sprintf("scan:task:%s:runs:%d", cfg.TaskID, ts)
			if err := storage.Put([]byte(idxKey), []byte(runID)); err != nil {
				logger.Warn("OnStarted: failed to store run index", "runID", runID, "error", err)
			}

			// Global timestamp index (for ListRecentRuns fast lookup)
			globalIdxKey := fmt.Sprintf("scan:runs:ts:%013d:%s", ts, runID)
			if err := storage.Put([]byte(globalIdxKey), []byte(runID)); err != nil {
				logger.Warn("OnStarted: failed to store global run index", "runID", runID, "error", err)
			}

			// Mark run as active
			activeKey := fmt.Sprintf("scan:run:active:%s", runID)
			if err := storage.Put([]byte(activeKey), []byte("1")); err != nil {
				logger.Warn("OnStarted: failed to mark active run", "runID", runID, "error", err)
			}

			// Store variable snapshot
			varsKey := fmt.Sprintf("scan:run:%s:vars", runID)
			if err := storage.Put([]byte(varsKey), utils.MustJSON(cfg.Variables)); err != nil {
				logger.Warn("OnStarted: failed to store variables", "runID", runID, "error", err)
			}

			requestKey := fmt.Sprintf("scan:run:%s:request", runID)
			if err := storage.Put([]byte(requestKey), utils.MustJSON(cfg.Request)); err != nil {
				logger.Warn("OnStarted: failed to store request template", "runID", runID, "error", err)
			}

			// Emit event
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "scanner:run:started", map[string]any{
					"runID":  runID,
					"taskID": cfg.TaskID,
					"total":  total,
				})
			}
		},
		OnStep: func(step scanner.StepResult) {
			defer func() {
				if r := recover(); r != nil {
					logger.Error("OnStep callback panic", "runID", step.RunID, "error", r)
					sentry.CurrentHub().Recover(r)
				}
			}()

			idx := atomic.AddInt32(&stepIdx, 1)
			key := fmt.Sprintf("scan:run:%s:step:%05d", step.RunID, idx)
			if err := storage.Put([]byte(key), utils.MustJSON(step)); err != nil {
				logger.Warn("OnStep: failed to store step", "runID", step.RunID, "idx", idx, "error", err)
			}
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "scanner:run:progress", step)
			}
		},
		OnFinished: func(summary scanner.RunResult) {
			defer func() {
				if r := recover(); r != nil {
					logger.Error("OnFinished callback panic", "runID", summary.RunID, "error", r)
					sentry.CurrentHub().Recover(r)
				}
			}()

			metaKey := fmt.Sprintf("scan:run:%s:meta", summary.RunID)
			if err := storage.Put([]byte(metaKey), utils.MustJSON(summary)); err != nil {
				logger.Warn("OnFinished: failed to store summary", "runID", summary.RunID, "error", err)
			}

			s.mu.Lock()
			if c, ok := s.cancels[summary.RunID]; ok {
				c()
				delete(s.cancels, summary.RunID)
			}
			s.mu.Unlock()

			// Remove active run marker
			activeKey := fmt.Sprintf("scan:run:active:%s", summary.RunID)
			if err := storage.Delete([]byte(activeKey)); err != nil {
				logger.Warn("OnFinished: failed to delete active marker", "runID", summary.RunID, "error", err)
			}

			// Update task status: set to done upon completion
			if err := s.updateTaskStatus(summary.TaskID, "done"); err != nil {
				logger.Warn("OnFinished: failed to update task status", "taskID", summary.TaskID, "error", err)
			}

			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "scanner:run:finished", summary)
			}
		},
	})
	if err != nil {
		cancel()
		return "", err
	}
	return runID, nil
}

// CancelScan cancels a running scan.
func (s *ScannerService) CancelScan(runID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.cancels[runID]
	if !ok {
		return errors.New("运行未找到或已完成")
	}
	c()
	delete(s.cancels, runID)
	return nil
}

// GetRunSummary reads the stored run summary.
func (s *ScannerService) GetRunSummary(runID string) (scanner.RunResult, error) {
	var out scanner.RunResult
	b, err := storage.Get([]byte(fmt.Sprintf("scan:run:%s:meta", runID)))
	if err != nil {
		return out, err
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return out, err
	}
	return out, nil
}

// ListTaskRuns returns run summaries for a specific task, ascending by timestamp (oldest first).
func (s *ScannerService) ListTaskRuns(taskID string, offset, limit int) ([]scanner.RunResult, error) {
	prefix := fmt.Sprintf("scan:task:%s:runs:", taskID)
	items, err := storage.ListByPrefix([]byte(prefix), 0, maxListLimit)
	if err != nil {
		return nil, err
	}

	// Parse timestamp and runID
	type pair struct {
		ts    int64
		runID string
	}
	arr := make([]pair, 0, len(items))
	for _, it := range items {
		suf := strings.TrimPrefix(string(it.Key), prefix)
		runID := string(it.Value)
		var ts int64
		fmt.Sscanf(suf, "%d", &ts)
		arr = append(arr, pair{ts: ts, runID: runID})
	}

	// Sort by timestamp ascending
	sort.Slice(arr, func(i, j int) bool { return arr[i].ts < arr[j].ts })

	// Handle pagination
	if offset < 0 {
		offset = 0
	}
	end := len(arr)
	if limit > 0 {
		end = min(len(arr), offset+limit)
	}
	if offset > len(arr) {
		return []scanner.RunResult{}, nil
	}
	slice := arr[offset:end]

	// Get detailed data
	results := make([]scanner.RunResult, 0, len(slice))
	for _, p := range slice {
		metaKey := fmt.Sprintf("scan:run:%s:meta", p.runID)
		b, err := storage.Get([]byte(metaKey))
		if err != nil {
			continue
		}
		var rr scanner.RunResult
		if json.Unmarshal(b, &rr) == nil {
			results = append(results, rr)
		}
	}
	return results, nil
}

// StartScanForTask builds RunConfig from local database configuration and starts standard scan.
func (s *ScannerService) StartScanForTask(taskID string, req scanner.RequestSpec, samples []scanner.Sample, variables map[string]string) (string, error) {
	if taskID == "" {
		return "", errors.New("taskID 为必填")
	}

	// Load stored configuration from Badger
	key := fmt.Sprintf("scan:cfg:%s", taskID)
	b, err := storage.Get([]byte(key))
	// Define lightweight struct matching stored JSON format
	var saved struct {
		Retry struct {
			MaxAttempts         int `json:"maxAttempts"`
			PerAttemptTimeoutMs int `json:"perAttemptTimeoutMs"`
			BaseBackoffMs       int `json:"baseBackoffMs"`
			MaxBackoffMs        int `json:"maxBackoffMs"`
			JitterPct           int `json:"jitterPct"`
		} `json:"retry"`
		Status struct {
			ExpectedSuccess []string `json:"expectedSuccess"`
			RetryOn         []string `json:"retryOn"`
			FailOn          []string `json:"failOn"`
		} `json:"status"`
		AbortAfterFailures int `json:"abortAfterFailures"`
	}
	if err == nil && len(b) > 0 {
		_ = json.Unmarshal(b, &saved)
	}

	cfg := scanner.RunConfig{
		TaskID:             taskID,
		AbortAfterFailures: saved.AbortAfterFailures,
		Retry: scanner.RetryPolicy{
			MaxAttempts:         saved.Retry.MaxAttempts,
			PerAttemptTimeoutMs: saved.Retry.PerAttemptTimeoutMs,
			BaseBackoffMs:       saved.Retry.BaseBackoffMs,
			MaxBackoffMs:        saved.Retry.MaxBackoffMs,
			JitterPct:           saved.Retry.JitterPct,
		},
		Status: scanner.StatusPolicy{
			ExpectedSuccess: saved.Status.ExpectedSuccess,
			RetryOn:         saved.Status.RetryOn,
			FailOn:          saved.Status.FailOn,
		},
		Variables: variables,
		Request:   req,
		Samples:   samples,
	}

	return s.StartScan(cfg)
}

// ListRunSteps returns all step data for a run.
func (s *ScannerService) ListRunSteps(runID string, offset, limit int) ([]scanner.StepResult, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > maxRunStepsListLimit {
		limit = maxRunStepsListLimit
	}

	prefix := fmt.Sprintf("scan:run:%s:step:", runID)
	items, err := storage.ListByPrefix([]byte(prefix), offset, limit)
	if err != nil {
		return nil, err
	}

	steps := make([]scanner.StepResult, 0, len(items))
	for _, item := range items {
		var step scanner.StepResult
		if json.Unmarshal(item.Value, &step) == nil {
			steps = append(steps, step)
		}
	}

	return steps, nil
}

// GetFailedSteps returns the final failed sample attempts from a run.
func (s *ScannerService) GetFailedSteps(runID string) ([]scanner.StepResult, error) {
	allSteps, err := s.ListRunSteps(runID, 0, 10000)
	if err != nil {
		return nil, err
	}

	type sampleState struct {
		latest  scanner.StepResult
		success bool
		seen    bool
	}
	bySample := make(map[string]sampleState)
	for _, step := range allSteps {
		key := step.SampleID
		if key == "" {
			key = fmt.Sprintf("%s:%d", step.RunID, step.Attempt)
		}
		state := bySample[key]
		if step.Success {
			state.success = true
		}
		if !state.seen || step.Attempt >= state.latest.Attempt {
			state.latest = step
			state.seen = true
		}
		bySample[key] = state
	}

	failed := make([]scanner.StepResult, 0)
	for _, state := range bySample {
		if !state.success && !state.latest.Success {
			failed = append(failed, state.latest)
		}
	}
	sort.Slice(failed, func(i, j int) bool {
		if failed[i].SampleID == failed[j].SampleID {
			return failed[i].Attempt < failed[j].Attempt
		}
		return failed[i].SampleID < failed[j].SampleID
	})
	return failed, nil
}

// CountFailedSteps returns the count of failed steps in a run.
func (s *ScannerService) CountFailedSteps(runID string) (int, error) {
	failed, err := s.GetFailedSteps(runID)
	if err != nil {
		return 0, err
	}
	return len(failed), nil
}

// RetryFailedRequests retries all failed requests from a previous run.
// It creates a new run with only the failed samples.
func (s *ScannerService) RetryFailedRequests(runID string) (string, error) {
	// Get original run summary
	summary, err := s.GetRunSummary(runID)
	if err != nil {
		return "", fmt.Errorf("failed to get run summary: %w", err)
	}

	taskID := summary.TaskID
	if taskID == "" {
		return "", errors.New("task ID not found in run summary")
	}

	// Get failed steps
	failedSteps, err := s.GetFailedSteps(runID)
	if err != nil {
		return "", fmt.Errorf("failed to get failed steps: %w", err)
	}

	if len(failedSteps) == 0 {
		return "", errors.New("no failed requests to retry")
	}

	// Get original variables
	varsKey := fmt.Sprintf("scan:run:%s:vars", runID)
	varsData, _ := storage.Get([]byte(varsKey))
	var variables map[string]string
	if len(varsData) > 0 {
		_ = json.Unmarshal(varsData, &variables)
	}

	var reqSpec scanner.RequestSpec
	requestKey := fmt.Sprintf("scan:run:%s:request", runID)
	if requestData, getErr := storage.Get([]byte(requestKey)); getErr == nil && len(requestData) > 0 {
		_ = json.Unmarshal(requestData, &reqSpec)
	}
	if reqSpec.BaseURL == "" && len(failedSteps) > 0 {
		reqSpec = failedSteps[0].FinalRequest
	}

	// Build samples from failed steps
	samples := make([]scanner.Sample, 0, len(failedSteps))
	seenIDs := make(map[string]bool)
	for _, step := range failedSteps {
		if seenIDs[step.SampleID] {
			continue // Avoid duplicates
		}
		seenIDs[step.SampleID] = true

		// Extract prompt from the original request
		prompt := ""
		if step.FinalRequest.BodyJSON != "" {
			requestField := reqSpec.RequestField
			if requestField == "" {
				requestField = step.FinalRequest.RequestField
			}
			prompt = extractStringFromJSONPath(step.FinalRequest.BodyJSON, requestField)
			var body map[string]any
			if prompt == "" && json.Unmarshal([]byte(step.FinalRequest.BodyJSON), &body) == nil {
				// Try to extract from nested path (e.g., messages[0].content)
				if messages, ok := body["messages"].([]any); ok && len(messages) > 0 {
					if msg, ok := messages[len(messages)-1].(map[string]any); ok {
						if content, ok := msg["content"].(string); ok {
							prompt = content
						}
					}
				}
				// Fallback: try direct content field
				if prompt == "" {
					if content, ok := body["content"].(string); ok {
						prompt = content
					}
				}
			}
		}

		samples = append(samples, scanner.Sample{
			ID:     step.SampleID,
			Prompt: prompt,
		})
	}

	// Load task's sample service to get full sample data
	sampleSvc := NewSampleService()
	taskSamples, err := sampleSvc.LoadSamplesForTask(taskID)
	if err == nil && len(taskSamples) > 0 {
		// Rebuild samples with full data from sample service
		fullSamples := make([]scanner.Sample, 0, len(samples))
		sampleMap := make(map[string]scanner.Sample)
		for _, s := range taskSamples {
			sampleMap[s.ID] = s
		}
		for _, s := range samples {
			if full, ok := sampleMap[s.ID]; ok {
				fullSamples = append(fullSamples, full)
			} else {
				fullSamples = append(fullSamples, s)
			}
		}
		samples = fullSamples
	}

	logger.Info("RetryFailedRequests",
		"runID", runID,
		"taskID", taskID,
		"failedCount", len(samples),
	)

	// Start new scan with failed samples
	return s.StartScanForTask(taskID, reqSpec, samples, variables)
}

func extractStringFromJSONPath(bodyJSON, fieldPath string) string {
	fieldPath = strings.TrimSpace(fieldPath)
	if strings.TrimSpace(bodyJSON) == "" || fieldPath == "" {
		return ""
	}

	var root any
	if err := json.Unmarshal([]byte(bodyJSON), &root); err != nil {
		return ""
	}

	current := root
	normalizedPath := utils.ArrayIndexRe.ReplaceAllString(fieldPath, ".$1")
	for _, part := range strings.Split(normalizedPath, ".") {
		if part == "" {
			return ""
		}
		switch typed := current.(type) {
		case map[string]any:
			next, ok := typed[part]
			if !ok {
				return ""
			}
			current = next
		case []any:
			idx, err := strconv.Atoi(part)
			if err != nil || idx < 0 || idx >= len(typed) {
				return ""
			}
			current = typed[idx]
		default:
			return ""
		}
	}

	switch v := current.(type) {
	case string:
		return v
	case nil:
		return ""
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return ""
		}
		return string(b)
	}
}
