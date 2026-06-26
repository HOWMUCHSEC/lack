package evaluator

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"time"

	"lack-client/pkg/logger"
	"lack-client/pkg/storage"
)

const (
	MaxEvalSampleCount = MaxEvalLoadedItems
	MaxEvalConcurrency = 20
	MaxEvalRetries     = 5
	MaxEvalTimeoutMs   = 120000
)

// Storage prefix constants
const (
	prefixEvalProject    = "eval:project:"
	prefixEvalTask       = "eval:task:"
	prefixEvalItem       = "eval:task:%s:item:"
	prefixEvalTaskByProj = "eval:proj:%s:task:" // Secondary index: tasks by project
)

// PrepareCallbacks defines callbacks for the preparation process.
type PrepareCallbacks struct {
	OnProgress func(taskID string, current, total int)
	OnReady    func(taskID string, totalItems int)
	OnError    func(taskID string, err error)
}

// PrepareTask asynchronously prepares a task (loading data, generating TestItems).
func PrepareTask(ctx context.Context, taskID string, cb PrepareCallbacks) {
	go func() {
		if err := doPrepareTask(ctx, taskID, cb); err != nil {
			logger.Error("PrepareTask failed", "taskID", taskID, "error", err)

			// Update task status to failed
			if task, getErr := GetTask(taskID); getErr == nil && task != nil {
				task.Status = TaskStatusFailed
				task.ErrorMessage = err.Error()
				task.UpdatedAt = time.Now().UnixMilli()
				if saveErr := SaveTask(task); saveErr != nil {
					logger.Error("PrepareTask save failed status error", "taskID", taskID, "error", saveErr)
				}
			}

			if cb.OnError != nil {
				cb.OnError(taskID, err)
			}
		}
	}()
}

// doPrepareTask executes the task preparation logic.
func doPrepareTask(ctx context.Context, taskID string, cb PrepareCallbacks) error {
	// 1. Get task
	task, err := GetTask(taskID)
	if err != nil {
		return fmt.Errorf("get task error: %w", err)
	}
	if task == nil {
		return fmt.Errorf("task not found: %s", taskID)
	}
	normalizeTaskLimits(task)

	// 2. Update status to preparing
	task.Status = TaskStatusPreparing
	task.UpdatedAt = time.Now().UnixMilli()
	if err := SaveTask(task); err != nil {
		return fmt.Errorf("save task error: %w", err)
	}

	// 3. Fetch evaluator template from cloud
	template, err := GetCachedTemplate(task.EvaluatorType)
	if err != nil {
		return fmt.Errorf("get evaluator template error: %w", err)
	}
	task.TemplateID = template.ID

	// 4. Validate dataset configuration
	if err := ValidateDatasetConfig(task.DatasetConfig); err != nil {
		return fmt.Errorf("validate dataset config error: %w", err)
	}

	// 5. Load data with a hard cap so large UI-selected datasets cannot exhaust memory.
	loadLimit := task.SampleCount
	if loadLimit <= 0 || loadLimit > MaxEvalSampleCount {
		loadLimit = MaxEvalSampleCount
	}
	allItems, err := LoadAllDatasetsLimited(task.DatasetConfig, template, loadLimit)
	if err != nil {
		return fmt.Errorf("load datasets error: %w", err)
	}

	if len(allItems) == 0 {
		return fmt.Errorf("no data items found")
	}

	logger.Info("PrepareTask loaded data", "taskID", taskID, "totalItems", len(allItems))

	// 6. Random sampling
	if task.SampleSeed == 0 {
		task.SampleSeed = time.Now().UnixNano()
	}

	rng := rand.New(rand.NewSource(task.SampleSeed))
	rng.Shuffle(len(allItems), func(i, j int) {
		allItems[i], allItems[j] = allItems[j], allItems[i]
	})

	if task.SampleCount > 0 && task.SampleCount < len(allItems) {
		allItems = allItems[:task.SampleCount]
		logger.Info("PrepareTask sampled", "taskID", taskID, "sampleCount", task.SampleCount)
	}

	if err := deleteTestItemsForTask(taskID); err != nil {
		return fmt.Errorf("delete existing test items error: %w", err)
	}

	// 7. Generate TestItems (batch write optimization)
	now := time.Now().UnixMilli()
	const batchSize = 100
	batch := make([]storage.BatchItem, 0, batchSize)

	for i, item := range allItems {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Apply task-level field mappings
		mappedData := ApplyFieldMappings(item.Data, task.DatasetConfig.FieldMappings)

		// Generate target prompt (using mapped data)
		prompt := GenerateTargetPrompt(template, mappedData)

		// 提取元信息 (using mapped data for consistency)
		category, riskArea, expectedBehavior := ExtractMetadata(mappedData)

		testItem := TestItem{
			ID:               fmt.Sprintf("%s-%05d", taskID, i),
			TaskID:           taskID,
			Index:            i,
			SourceType:       item.SourceType,
			SourceID:         item.SourceID,
			OriginalData:     item.Data,
			TargetPrompt:     prompt,
			Category:         category,
			RiskArea:         riskArea,
			ExpectedBehavior: expectedBehavior,
			Status:           ItemStatusPending,
			CreatedAt:        now,
			UpdatedAt:        now,
		}

		// Add to batch
		key := []byte(fmt.Sprintf("eval:task:%s:item:%05d", taskID, i))
		data, err := json.Marshal(testItem)
		if err != nil {
			return fmt.Errorf("marshal test item error: %w", err)
		}
		batch = append(batch, storage.BatchItem{Key: key, Value: data})

		// Write batch
		if len(batch) >= batchSize {
			if err := storage.PutBatch(batch); err != nil {
				return fmt.Errorf("batch save test items error: %w", err)
			}
			batch = batch[:0]

			// Progress callback
			if cb.OnProgress != nil {
				cb.OnProgress(taskID, i+1, len(allItems))
			}
		}
	}

	// Write remaining batch
	if len(batch) > 0 {
		if err := storage.PutBatch(batch); err != nil {
			return fmt.Errorf("batch save test items error: %w", err)
		}
	}

	// 8. Update task status to ready
	task.Status = TaskStatusReady
	task.TotalItems = len(allItems)
	task.PreparedAt = time.Now().UnixMilli()
	task.UpdatedAt = time.Now().UnixMilli()

	if err := SaveTask(task); err != nil {
		return fmt.Errorf("save task error: %w", err)
	}

	logger.Info("PrepareTask completed", "taskID", taskID, "totalItems", len(allItems))

	// Completion callback
	if cb.OnReady != nil {
		cb.OnReady(taskID, len(allItems))
	}

	return nil
}

func normalizeTaskLimits(task *EvalTask) {
	if task.SampleCount < 0 {
		task.SampleCount = 0
	}
	if task.SampleCount > MaxEvalSampleCount {
		task.SampleCount = MaxEvalSampleCount
	}
	if task.Concurrency <= 0 {
		task.Concurrency = 1
	}
	if task.Concurrency > MaxEvalConcurrency {
		task.Concurrency = MaxEvalConcurrency
	}
	if task.MaxRetries < 0 {
		task.MaxRetries = 0
	}
	if task.MaxRetries > MaxEvalRetries {
		task.MaxRetries = MaxEvalRetries
	}
	if task.TimeoutMs <= 0 {
		task.TimeoutMs = 30000
	}
	if task.TimeoutMs > MaxEvalTimeoutMs {
		task.TimeoutMs = MaxEvalTimeoutMs
	}
}

// ============================================================
// 项目 CRUD
// ============================================================

// SaveProject saves a project.
func SaveProject(p *EvalProject) error {
	key := []byte(prefixEvalProject + p.ID)
	data, err := json.Marshal(p)
	if err != nil {
		return fmt.Errorf("marshal project error: %w", err)
	}
	return storage.Put(key, data)
}

// GetProject retrieves a project.
func GetProject(id string) (*EvalProject, error) {
	key := []byte(prefixEvalProject + id)
	data, err := storage.Get(key)
	if err != nil {
		return nil, err
	}

	var p EvalProject
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, err
	}
	return &p, nil
}

// DeleteProject deletes a project.
func DeleteProject(id string) error {
	key := []byte(prefixEvalProject + id)
	return storage.Delete(key)
}

// ListProjects lists all projects.
func ListProjects(offset, limit int) ([]EvalProject, int, error) {
	if limit <= 0 {
		limit = 50
	}

	items, err := storage.ListByPrefix([]byte(prefixEvalProject), offset, limit+1)
	if err != nil {
		return nil, 0, err
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}

	projects := make([]EvalProject, 0, len(items))
	for _, item := range items {
		var p EvalProject
		if err := json.Unmarshal(item.Value, &p); err == nil {
			projects = append(projects, p)
		}
	}

	total, _ := storage.CountByPrefix([]byte(prefixEvalProject))

	return projects, total, nil
}

// ============================================================
// 任务 CRUD
// ============================================================

// SaveTask saves a task.
func SaveTask(t *EvalTask) error {
	key := []byte(prefixEvalTask + t.ID)
	data, err := json.Marshal(t)
	if err != nil {
		return fmt.Errorf("marshal task error: %w", err)
	}
	if err := storage.Put(key, data); err != nil {
		return err
	}
	// Maintain secondary index
	if t.ProjectID != "" {
		idxKey := []byte(fmt.Sprintf(prefixEvalTaskByProj, t.ProjectID) + t.ID)
		_ = storage.Put(idxKey, []byte(t.ID))
	}
	return nil
}

// GetTask retrieves a task.
func GetTask(id string) (*EvalTask, error) {
	key := []byte(prefixEvalTask + id)
	data, err := storage.Get(key)
	if err != nil {
		return nil, err
	}

	var t EvalTask
	if err := json.Unmarshal(data, &t); err != nil {
		return nil, err
	}
	return &t, nil
}

// DeleteTask deletes a task and all its TestItems.
func DeleteTask(id string) error {
	// Get task first to get projectID
	task, _ := GetTask(id)

	if err := deleteTestItemsForTask(id); err != nil {
		logger.Warn("DeleteTask batch delete items error", "taskID", id, "error", err)
	}

	// Delete secondary index
	if task != nil && task.ProjectID != "" {
		idxKey := []byte(fmt.Sprintf(prefixEvalTaskByProj, task.ProjectID) + id)
		_ = storage.Delete(idxKey)
	}

	// Delete task
	key := []byte(prefixEvalTask + id)
	return storage.Delete(key)
}

func deleteTestItemsForTask(taskID string) error {
	prefix := []byte(fmt.Sprintf(prefixEvalItem, taskID))
	items, err := storage.ListByPrefix(prefix, 0, 0)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		return nil
	}

	const batchSize = 500
	keys := make([][]byte, 0, batchSize)
	for _, item := range items {
		keys = append(keys, item.Key)
		if len(keys) >= batchSize {
			if err := storage.DeleteBatch(keys); err != nil {
				return err
			}
			keys = keys[:0]
		}
	}
	if len(keys) > 0 {
		return storage.DeleteBatch(keys)
	}
	return nil
}

// ListTasks lists all tasks under a project.
func ListTasks(projectID string, offset, limit int) ([]EvalTask, int, error) {
	if limit <= 0 {
		limit = 50
	}

	var taskIDs []string

	if projectID != "" {
		// Use secondary index for fast query
		idxPrefix := []byte(fmt.Sprintf(prefixEvalTaskByProj, projectID))
		idxItems, err := storage.ListByPrefix(idxPrefix, 0, 0)
		if err != nil {
			return nil, 0, err
		}
		for _, item := range idxItems {
			taskIDs = append(taskIDs, string(item.Value))
		}
	} else {
		// No project filter, iterate all tasks
		allItems, err := storage.ListByPrefix([]byte(prefixEvalTask), 0, 0)
		if err != nil {
			return nil, 0, err
		}
		for _, item := range allItems {
			// Extract taskID from key
			keyStr := string(item.Key)
			if len(keyStr) > len(prefixEvalTask) {
				taskIDs = append(taskIDs, keyStr[len(prefixEvalTask):])
			}
		}
	}

	total := len(taskIDs)

	// Pagination
	start := offset
	if start > total {
		start = total
	}
	end := start + limit
	if end > total {
		end = total
	}
	pagedIDs := taskIDs[start:end]

	// Batch get task details
	tasks := make([]EvalTask, 0, len(pagedIDs))
	for _, id := range pagedIDs {
		if t, err := GetTask(id); err == nil && t != nil {
			tasks = append(tasks, *t)
		}
	}

	return tasks, total, nil
}

// ============================================================
// TestItem CRUD
// ============================================================

// SaveTestItem saves a test item.
func SaveTestItem(item *TestItem) error {
	key := []byte(fmt.Sprintf("eval:task:%s:item:%05d", item.TaskID, item.Index))
	data, err := json.Marshal(item)
	if err != nil {
		return fmt.Errorf("marshal test item error: %w", err)
	}
	return storage.Put(key, data)
}

// GetTestItem retrieves a test item.
func GetTestItem(taskID string, index int) (*TestItem, error) {
	key := []byte(fmt.Sprintf("eval:task:%s:item:%05d", taskID, index))
	data, err := storage.Get(key)
	if err != nil {
		return nil, err
	}

	var item TestItem
	if err := json.Unmarshal(data, &item); err != nil {
		return nil, err
	}
	return &item, nil
}

// ListTestItems lists all test items under a task.
func ListTestItems(taskID string, offset, limit int) ([]TestItem, int, error) {
	prefix := []byte(fmt.Sprintf("eval:task:%s:item:", taskID))
	fetchLimit := limit
	if limit > 0 {
		fetchLimit = limit + 1
	}

	items, err := storage.ListByPrefix(prefix, offset, fetchLimit)
	if err != nil {
		return nil, 0, err
	}

	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}

	testItems := make([]TestItem, 0, len(items))
	for _, item := range items {
		var ti TestItem
		if err := json.Unmarshal(item.Value, &ti); err == nil {
			testItems = append(testItems, ti)
		}
	}

	total, _ := storage.CountByPrefix(prefix)

	return testItems, total, nil
}

// CountTestItems counts the number of test items under a task.
func CountTestItems(taskID string) (int, error) {
	prefix := []byte(fmt.Sprintf("eval:task:%s:item:", taskID))
	return storage.CountByPrefix(prefix)
}
