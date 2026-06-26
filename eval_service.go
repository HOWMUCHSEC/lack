package main

import (
	"context"
	"fmt"
	"time"

	"lack-client/pkg/config"
	"lack-client/pkg/evaluator"
	"lack-client/pkg/logger"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// EvalService provides evaluation service methods exposed to the frontend via Wails bindings.
type EvalService struct {
	ctx context.Context
}

// NewEvalService creates and returns a new EvalService instance.
func NewEvalService() *EvalService {
	return &EvalService{}
}

// Startup initializes the service with the Wails application context.
func (s *EvalService) Startup(ctx context.Context) {
	s.ctx = ctx
}

// ------------------------------------------------------------
// Cloud Templates
// ------------------------------------------------------------

// ListEvaluatorTemplates returns a list of all available evaluator templates.
func (s *EvalService) ListEvaluatorTemplates() ([]evaluator.EvaluatorInfo, error) {
	return evaluator.ListCachedTemplates()
}

// GetEvaluatorTemplate returns the template details for the specified evaluator type.
func (s *EvalService) GetEvaluatorTemplate(evaluatorType string) (*evaluator.EvaluatorTemplate, error) {
	return evaluator.GetCachedTemplate(evaluatorType)
}

// SyncEvaluatorTemplates forces a refresh of the evaluator template cache.
func (s *EvalService) SyncEvaluatorTemplates() error {
	evaluator.ClearTemplateCache()
	_, err := evaluator.ListCachedTemplates()
	return err
}

// ------------------------------------------------------------
// Project Management
// ------------------------------------------------------------

// CreateProject creates a new evaluation project with the given configuration.
func (s *EvalService) CreateProject(p evaluator.EvalProject) (*evaluator.EvalProject, error) {
	now := time.Now().UnixMilli()

	if p.ID == "" {
		p.ID = fmt.Sprintf("proj-%d", now)
	}
	p.CreatedAt = now
	p.UpdatedAt = now

	if err := evaluator.SaveProject(&p); err != nil {
		return nil, err
	}

	logger.Info("CreateProject success", "id", p.ID, "name", p.Name)
	return &p, nil
}

// GetProject returns the project details for the specified ID.
func (s *EvalService) GetProject(id string) (*evaluator.EvalProject, error) {
	return evaluator.GetProject(id)
}

// ListProjects returns a paginated list of all projects.
func (s *EvalService) ListProjects(offset, limit int) evaluator.ListResult {
	projects, total, err := evaluator.ListProjects(offset, limit)
	if err != nil {
		logger.Error("ListProjects error", "error", err)
		return evaluator.ListResult{Items: []evaluator.EvalProject{}, Total: 0}
	}

	return evaluator.ListResult{
		Items:   projects,
		Total:   total,
		HasMore: offset+len(projects) < total,
	}
}

// UpdateProject updates an existing project with the given configuration.
func (s *EvalService) UpdateProject(p evaluator.EvalProject) (*evaluator.EvalProject, error) {
	if p.ID == "" {
		return nil, fmt.Errorf("project id is required")
	}

	existing, err := evaluator.GetProject(p.ID)
	if err != nil {
		return nil, fmt.Errorf("project not found: %s", p.ID)
	}

	p.CreatedAt = existing.CreatedAt
	p.UpdatedAt = time.Now().UnixMilli()

	if err := evaluator.SaveProject(&p); err != nil {
		return nil, err
	}

	logger.Info("UpdateProject success", "id", p.ID)
	return &p, nil
}

// DeleteProject removes the project with the specified ID.
func (s *EvalService) DeleteProject(id string) error {
	if err := evaluator.DeleteProject(id); err != nil {
		return err
	}
	logger.Info("DeleteProject success", "id", id)
	return nil
}

// ------------------------------------------------------------
// Task Management
// ------------------------------------------------------------

// CreateTask creates a new evaluation task and starts asynchronous preparation.
func (s *EvalService) CreateTask(t evaluator.EvalTask) (*evaluator.EvalTask, error) {
	now := time.Now().UnixMilli()

	// 生成 ID
	if t.ID == "" {
		t.ID = fmt.Sprintf("task-%d", now)
	}

	// 验证项目存在
	if t.ProjectID != "" {
		if _, err := evaluator.GetProject(t.ProjectID); err != nil {
			return nil, fmt.Errorf("project not found: %s", t.ProjectID)
		}
	}

	// 验证评测器类型
	if t.EvaluatorType == "" {
		return nil, fmt.Errorf("evaluator type is required")
	}
	if _, err := evaluator.GetCachedTemplate(t.EvaluatorType); err != nil {
		return nil, fmt.Errorf("invalid evaluator type: %s", t.EvaluatorType)
	}

	// 验证数据源配置
	if len(t.DatasetConfig.LocalSampleSetIDs) == 0 &&
		len(t.DatasetConfig.CloudSampleSetIDs) == 0 &&
		len(t.DatasetConfig.HfDatasets) == 0 {
		return nil, fmt.Errorf("at least one dataset source is required")
	}

	// 使用集中配置的默认值
	if t.Concurrency <= 0 {
		t.Concurrency = config.DefaultEvalConcurrency
	}
	if t.MaxRetries < 0 {
		t.MaxRetries = config.DefaultEvalMaxRetries
	}
	if t.TimeoutMs <= 0 {
		t.TimeoutMs = config.DefaultEvalTimeoutMs
	}
	if t.SampleSeed == 0 {
		t.SampleSeed = time.Now().UnixNano()
	}

	t.Status = evaluator.TaskStatusPending
	t.CreatedAt = now
	t.UpdatedAt = now

	// 保存任务
	if err := evaluator.SaveTask(&t); err != nil {
		return nil, err
	}

	logger.Info("CreateTask success", "id", t.ID, "name", t.Name, "evaluator", t.EvaluatorType)

	// 异步准备任务
	ctx := s.ctx
	if ctx == nil {
		logger.Warn("EvalService.CreateTask: ctx is nil, using context.Background(). This may indicate Startup() was not called.")
		ctx = context.Background()
	}

	evaluator.PrepareTask(ctx, t.ID, evaluator.PrepareCallbacks{
		OnProgress: func(taskID string, current, total int) {
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "eval:task:progress", map[string]any{
					"taskId":  taskID,
					"current": current,
					"total":   total,
				})
			}
		},
		OnReady: func(taskID string, totalItems int) {
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "eval:task:ready", map[string]any{
					"taskId":     taskID,
					"totalItems": totalItems,
				})
			}
		},
		OnError: func(taskID string, err error) {
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "eval:task:error", map[string]any{
					"taskId": taskID,
					"error":  err.Error(),
				})
			}
		},
	})

	return &t, nil
}

// GetTask returns the task details for the specified ID.
func (s *EvalService) GetTask(id string) (*evaluator.EvalTask, error) {
	return evaluator.GetTask(id)
}

// ListTasks returns a paginated list of tasks for the specified project.
func (s *EvalService) ListTasks(projectId string, offset, limit int) evaluator.ListResult {
	tasks, total, err := evaluator.ListTasks(projectId, offset, limit)
	if err != nil {
		logger.Error("ListTasks error", "error", err)
		return evaluator.ListResult{Items: []evaluator.EvalTask{}, Total: 0}
	}

	return evaluator.ListResult{
		Items:   tasks,
		Total:   total,
		HasMore: offset+len(tasks) < total,
	}
}

// DeleteTask removes the task with the specified ID and all its test items.
func (s *EvalService) DeleteTask(id string) error {
	if err := evaluator.DeleteTask(id); err != nil {
		return err
	}
	logger.Info("DeleteTask success", "id", id)
	return nil
}

// ------------------------------------------------------------
// Test Items
// ------------------------------------------------------------

// ListTestItems returns a paginated list of test items for the specified task.
func (s *EvalService) ListTestItems(taskId string, offset, limit int) evaluator.ListResult {
	items, total, err := evaluator.ListTestItems(taskId, offset, limit)
	if err != nil {
		logger.Error("ListTestItems error", "error", err)
		return evaluator.ListResult{Items: []evaluator.TestItem{}, Total: 0}
	}

	return evaluator.ListResult{
		Items:   items,
		Total:   total,
		HasMore: offset+len(items) < total,
	}
}

// GetTestItem returns the test item at the specified index for the given task.
func (s *EvalService) GetTestItem(taskId string, index int) (*evaluator.TestItem, error) {
	return evaluator.GetTestItem(taskId, index)
}

// CountTestItems returns the total number of test items for the specified task.
func (s *EvalService) CountTestItems(taskId string) (int, error) {
	return evaluator.CountTestItems(taskId)
}

// ------------------------------------------------------------
// Dataset Validation
// ------------------------------------------------------------

// ValidateDatasetConfig checks if the dataset configuration is valid and all sources are available.
func (s *EvalService) ValidateDatasetConfig(config evaluator.DatasetConfig) error {
	return evaluator.ValidateDatasetConfig(config)
}

// CountDatasetItems returns the total number of items across all configured datasets.
func (s *EvalService) CountDatasetItems(config evaluator.DatasetConfig) (int, error) {
	return evaluator.CountDatasetItems(config)
}

// ------------------------------------------------------------
// Task Execution
// ------------------------------------------------------------

// StartTask starts the evaluation task execution with the specified ID.
func (s *EvalService) StartTask(taskID string) error {
	// 获取任务
	task, err := evaluator.GetTask(taskID)
	if err != nil {
		return fmt.Errorf("task not found: %s", taskID)
	}

	// 检查任务状态
	if task.Status != evaluator.TaskStatusReady && task.Status != evaluator.TaskStatusPaused {
		return fmt.Errorf("task is not ready or paused, current status: %s", task.Status)
	}

	// 获取项目
	project, err := evaluator.GetProject(task.ProjectID)
	if err != nil {
		return fmt.Errorf("project not found: %s", task.ProjectID)
	}

	// 获取模板
	template, err := evaluator.GetCachedTemplate(task.EvaluatorType)
	if err != nil {
		return fmt.Errorf("template not found: %s", task.EvaluatorType)
	}

	// 创建执行器
	executor := evaluator.NewExecutor(task, project, template, evaluator.ExecutorCallbacks{
		OnItemStart: func(taskID string, itemIndex int) {
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "eval:item:start", map[string]any{
					"taskId":    taskID,
					"itemIndex": itemIndex,
				})
			}
		},
		OnItemComplete: func(taskID string, itemIndex int, result *evaluator.EvalResult) {
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "eval:item:complete", map[string]any{
					"taskId":    taskID,
					"itemIndex": itemIndex,
					"result":    result,
				})
			}
		},
		OnItemError: func(taskID string, itemIndex int, err error) {
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "eval:item:error", map[string]any{
					"taskId":    taskID,
					"itemIndex": itemIndex,
					"error":     err.Error(),
				})
			}
		},
		OnProgress: func(taskID string, completed, total int) {
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "eval:run:progress", map[string]any{
					"taskId":    taskID,
					"completed": completed,
					"total":     total,
				})
			}
		},
		OnFinish: func(taskID string, result *evaluator.EvalRunResult) {
			evaluator.UnregisterExecutor(taskID)
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "eval:run:finish", map[string]any{
					"taskId": taskID,
					"result": result,
				})
			}
		},
	})

	// 注册执行器
	if err := evaluator.RegisterExecutor(taskID, executor); err != nil {
		return err
	}

	// 启动执行
	if err := executor.Start(); err != nil {
		evaluator.UnregisterExecutor(taskID)
		return err
	}

	logger.Info("StartTask success", "taskID", taskID)
	return nil
}

// PauseTask pauses the running evaluation task with the specified ID.
func (s *EvalService) PauseTask(taskID string) error {
	executor := evaluator.GetExecutor(taskID)
	if executor == nil {
		return fmt.Errorf("task is not running: %s", taskID)
	}

	executor.Pause()
	logger.Info("PauseTask success", "taskID", taskID)
	return nil
}

// ResumeTask resumes a paused evaluation task with the specified ID.
func (s *EvalService) ResumeTask(taskID string) error {
	executor := evaluator.GetExecutor(taskID)
	if executor == nil {
		// 任务可能已经暂停后重启了应用，需要重新启动
		return s.StartTask(taskID)
	}

	executor.Resume()
	logger.Info("ResumeTask success", "taskID", taskID)
	return nil
}

// CancelTask cancels the running or paused evaluation task with the specified ID.
func (s *EvalService) CancelTask(taskID string) error {
	executor := evaluator.GetExecutor(taskID)
	if executor == nil {
		// 直接更新任务状态
		task, err := evaluator.GetTask(taskID)
		if err != nil {
			return err
		}
		task.Status = evaluator.TaskStatusFailed
		task.ErrorMessage = "cancelled by user"
		task.UpdatedAt = time.Now().UnixMilli()
		if _, repairErr := evaluator.FailRunningTestItems(taskID, "execution cancelled", task.UpdatedAt); repairErr != nil {
			logger.Warn("CancelTask repair running items failed", "taskID", taskID, "error", repairErr)
		}
		return evaluator.SaveTask(task)
	}

	executor.Cancel()
	logger.Info("CancelTask success", "taskID", taskID)
	return nil
}

// GetRunResult returns the execution result for the specified run ID.
func (s *EvalService) GetRunResult(runID string) (*evaluator.EvalRunResult, error) {
	return evaluator.GetRunResult(runID)
}

// GetTaskStats returns aggregated statistics for the specified task.
func (s *EvalService) GetTaskStats(taskID string) (map[string]any, error) {
	items, total, err := evaluator.ListTestItems(taskID, 0, 0)
	if err != nil {
		return nil, err
	}

	// 使用强类型变量直接累加，避免重复类型断言开销
	var pending, running, completed, failed, passed int
	var totalScore float64
	var scoredCount int

	for _, item := range items {
		switch item.Status {
		case evaluator.ItemStatusPending:
			pending++
		case evaluator.ItemStatusRunning:
			running++
		case evaluator.ItemStatusCompleted:
			completed++
			if item.EvalResult != nil {
				if item.EvalResult.Label == "pass" {
					passed++
				}
				if item.EvalResult.Score > 0 {
					totalScore += item.EvalResult.Score
					scoredCount++
				}
			}
		case evaluator.ItemStatusFailed:
			failed++
		}
	}

	var avgScore float64
	if scoredCount > 0 {
		avgScore = totalScore / float64(scoredCount)
	}

	return map[string]any{
		"total":     total,
		"pending":   pending,
		"running":   running,
		"completed": completed,
		"failed":    failed,
		"passed":    passed,
		"avgScore":  avgScore,
	}, nil
}

// ------------------------------------------------------------
// Dataset Field Discovery
// ------------------------------------------------------------

// DatasetFieldInfo represents field information for UI display.
type DatasetFieldInfo struct {
	Name         string `json:"name"`
	SampleValue  string `json:"sampleValue"`
	InferredType string `json:"inferredType"` // prompt, context, output, other
}

// GetDatasetFields returns available fields from dataset samples for field mapping configuration.
// It loads a small sample from the configured datasets and extracts field names.
func (s *EvalService) GetDatasetFields(config evaluator.DatasetConfig) ([]DatasetFieldInfo, error) {
	// Load a small sample (just need one item to see field structure)
	items, err := evaluator.LoadAllDatasetsLimited(config, nil, 1)
	if err != nil {
		return nil, fmt.Errorf("load datasets error: %w", err)
	}

	if len(items) == 0 {
		return nil, fmt.Errorf("no data items found in datasets")
	}

	// Use first item to extract fields
	sampleData := items[0].Data
	var fields []DatasetFieldInfo

	for fieldName, value := range sampleData {
		strVal, ok := value.(string)
		if !ok {
			continue // Only show string fields for mapping
		}

		// Truncate sample value for display
		sampleValue := strVal
		if len(sampleValue) > 100 {
			sampleValue = sampleValue[:100] + "..."
		}

		// Infer field type
		inferredType := inferFieldType(fieldName)

		fields = append(fields, DatasetFieldInfo{
			Name:         fieldName,
			SampleValue:  sampleValue,
			InferredType: inferredType,
		})
	}

	return fields, nil
}

// inferFieldType infers the standard field type from field name.
func inferFieldType(fieldName string) string {
	promptFields := []string{"prompt", "question", "instruction", "goal", "input", "query", "text", "content", "message", "user_input", "user_message", "request"}
	contextFields := []string{"context", "system", "system_prompt", "background", "description"}
	outputFields := []string{"output", "answer", "response", "expected", "expected_output", "target", "completion"}

	for _, f := range promptFields {
		if fieldName == f {
			return "prompt"
		}
	}
	for _, f := range contextFields {
		if fieldName == f {
			return "context"
		}
	}
	for _, f := range outputFields {
		if fieldName == f {
			return "output"
		}
	}
	return "other"
}
