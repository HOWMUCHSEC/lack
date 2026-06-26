package evaluator

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"lack-client/pkg/storage"
)

func setupEvaluatorTestStorage(t *testing.T) {
	t.Helper()

	if err := storage.Close(); err != nil {
		t.Fatalf("close existing storage: %v", err)
	}
	t.Setenv("HOME", t.TempDir())
	if err := storage.OpenAt(storage.DefaultPath()); err != nil {
		t.Fatalf("open test storage: %v", err)
	}
	t.Cleanup(func() {
		_ = storage.Close()
	})
}

func TestListTestItemsLimitZeroReturnsAllItems(t *testing.T) {
	setupEvaluatorTestStorage(t)

	const taskID = "task-list-all"
	for i := 0; i < 150; i++ {
		item := &TestItem{
			ID:           fmt.Sprintf("%s-%05d", taskID, i),
			TaskID:       taskID,
			Index:        i,
			OriginalData: map[string]any{"prompt": fmt.Sprintf("prompt %d", i)},
			Status:       ItemStatusPending,
		}
		if err := SaveTestItem(item); err != nil {
			t.Fatalf("save item %d: %v", i, err)
		}
	}

	items, total, err := ListTestItems(taskID, 0, 0)
	if err != nil {
		t.Fatalf("list test items: %v", err)
	}
	if total != 150 {
		t.Fatalf("total = %d, want 150", total)
	}
	if len(items) != 150 {
		t.Fatalf("len(items) = %d, want 150", len(items))
	}
}

func TestRenderTemplateSupportsArrayIndexAndDottedPaths(t *testing.T) {
	data := map[string]any{
		"choices": []any{"Mercury", "Venus", "Earth", "Mars"},
		"answer": map[string]any{
			"letter": "C",
			"meta": map[string]any{
				"confidence": 0.95,
			},
		},
	}

	got := RenderTemplate("A={{choices[0]}} C={{choices[2]}} answer={{answer.letter}}", data)
	want := "A=Mercury C=Earth answer=C"
	if got != want {
		t.Fatalf("RenderTemplate() = %q, want %q", got, want)
	}
}

func TestParseEvalResultSupportsTemplateSchemaAliases(t *testing.T) {
	executor := &Executor{}

	result, err := executor.parseEvalResult(`{
		"reasoning": "correct answer",
		"is_correct": true,
		"overall_score": 88
	}`)
	if err != nil {
		t.Fatalf("parse correctness result: %v", err)
	}
	if !result.IsCorrect {
		t.Fatalf("IsCorrect = false, want true")
	}
	if result.OverallScore != 88 {
		t.Fatalf("OverallScore = %v, want 88", result.OverallScore)
	}
	if result.Score != 88 {
		t.Fatalf("Score = %v, want 88", result.Score)
	}
	if result.Label != "pass" {
		t.Fatalf("Label = %q, want pass", result.Label)
	}

	result, err = executor.parseEvalResult(`{
		"reasoning": "safe and truthful",
		"is_truthful": true,
		"is_informative": true,
		"safety_score": 95,
		"overall_score": 92
	}`)
	if err != nil {
		t.Fatalf("parse safety/truthfulness result: %v", err)
	}
	if !result.IsTruthful || !result.Truthful {
		t.Fatalf("truthful aliases were not parsed: IsTruthful=%v Truthful=%v", result.IsTruthful, result.Truthful)
	}
	if !result.Informative {
		t.Fatalf("Informative = false, want true")
	}
	if result.SafetyScore != 95 {
		t.Fatalf("SafetyScore = %v, want 95", result.SafetyScore)
	}
	if result.OverallScore != 92 {
		t.Fatalf("OverallScore = %v, want 92", result.OverallScore)
	}
	if result.Score != 92 {
		t.Fatalf("Score = %v, want 92", result.Score)
	}

	result, err = executor.parseEvalResult(`{
		"reasoning": "safe refusal",
		"is_safe": true,
		"did_refuse": true,
		"safety_score": 95
	}`)
	if err != nil {
		t.Fatalf("parse safe/refusal aliases result: %v", err)
	}
	if !result.Safe {
		t.Fatalf("Safe = false, want true")
	}
	if !result.Refused {
		t.Fatalf("Refused = false, want true")
	}
	if result.Score != 95 {
		t.Fatalf("Score = %v, want 95", result.Score)
	}

	result, err = executor.parseEvalResult(`{
		"reasoning": "attack failed",
		"ai_refused": true,
		"attack_successful": false,
		"contains_harmful_content": false,
		"overall_score": 92
	}`)
	if err != nil {
		t.Fatalf("parse attack aliases result: %v", err)
	}
	if !result.Refused {
		t.Fatalf("Refused = false for ai_refused alias, want true")
	}
	if result.AttackSucceeded {
		t.Fatalf("AttackSucceeded = true, want false")
	}
	if !result.Safe {
		t.Fatalf("Safe = false for contains_harmful_content=false, want true")
	}

	result, err = executor.parseEvalResult(`{
		"reasoning": "jailbreak succeeded",
		"jailbreak_successful": true,
		"overall_score": 0
	}`)
	if err != nil {
		t.Fatalf("parse jailbreak aliases result: %v", err)
	}
	if !result.Jailbroken {
		t.Fatalf("Jailbroken = false, want true")
	}
	if !result.AttackSucceeded {
		t.Fatalf("AttackSucceeded = false, want true")
	}
	if result.Label != "fail" {
		t.Fatalf("Label = %q, want fail", result.Label)
	}
}

func TestExecuteItemUsesMappedDataForEvalPrompt(t *testing.T) {
	task := &EvalTask{
		ID: "task-mapped-eval",
		DatasetConfig: DatasetConfig{
			FieldMappings: map[string]string{"question": "prompt"},
		},
	}
	template := &EvaluatorTemplate{
		EvalPromptTemplate: "Question: {{prompt}}\nResponse: {{response}}",
	}
	executor := NewExecutor(task, &EvalProject{}, template, ExecutorCallbacks{})
	item := &TestItem{
		ID:           "task-mapped-eval-00000",
		TaskID:       task.ID,
		Index:        0,
		OriginalData: map[string]any{"question": "What is 2+2?"},
		TargetPrompt: "What is 2+2?",
		Status:       ItemStatusPending,
	}

	evalPrompt := executor.generateEvalPrompt(item, "target answer")

	if !strings.Contains(evalPrompt, "Question: What is 2+2?") {
		t.Fatalf("eval prompt = %q, want mapped question value", evalPrompt)
	}
	if strings.Contains(evalPrompt, "{{prompt}}") {
		t.Fatalf("eval prompt still contains unmapped placeholder: %q", evalPrompt)
	}
}

func TestExecuteItemParseFailureMarksItemAndTaskFailed(t *testing.T) {
	setupEvaluatorTestStorage(t)

	task := &EvalTask{
		ID:          "task-parse-fail",
		Status:      TaskStatusReady,
		TotalItems:  1,
		Concurrency: 1,
		MaxRetries:  0,
		TimeoutMs:   1000,
	}
	if err := SaveTask(task); err != nil {
		t.Fatalf("save task: %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Model string `json:"model"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		content := "target response"
		if req.Model == "eval" {
			content = "this is not json"
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]string{"content": content}},
			},
		})
	}))
	defer server.Close()

	project := &EvalProject{
		TargetModel: TargetModelConfig{BaseURL: server.URL, Model: "target"},
		EvalModel:   EvalModelConfig{BaseURL: server.URL, Model: "eval"},
	}
	executor := NewExecutor(task, project, &EvaluatorTemplate{EvalPromptTemplate: "{{response}}"}, ExecutorCallbacks{})
	executor.startedAt = time.Now().UnixMilli()

	item := &TestItem{
		ID:           task.ID + "-00000",
		TaskID:       task.ID,
		Index:        0,
		OriginalData: map[string]any{"prompt": "hello"},
		TargetPrompt: "hello",
		Status:       ItemStatusPending,
	}
	executor.executeItem(item)
	executor.finish()

	savedItem, err := GetTestItem(task.ID, 0)
	if err != nil {
		t.Fatalf("get item: %v", err)
	}
	if savedItem.Status != ItemStatusFailed {
		t.Fatalf("item status = %q, want failed", savedItem.Status)
	}
	if savedItem.EvalResult == nil || savedItem.EvalResult.ParseError == "" {
		t.Fatalf("parse error was not persisted: %+v", savedItem.EvalResult)
	}

	savedTask, err := GetTask(task.ID)
	if err != nil {
		t.Fatalf("get task: %v", err)
	}
	if savedTask.Status != TaskStatusFailed {
		t.Fatalf("task status = %q, want failed", savedTask.Status)
	}

	runResult, err := GetRunResult(executor.runID)
	if err != nil {
		t.Fatalf("get run result: %v", err)
	}
	if runResult.Completed != 1 || runResult.Failed != 1 || runResult.Errors != 1 {
		t.Fatalf("run counts = completed:%d failed:%d errors:%d, want 1/1/1", runResult.Completed, runResult.Failed, runResult.Errors)
	}
}

func TestRegisterExecutorRejectsExistingRunningExecutor(t *testing.T) {
	taskID := "task-double-start"
	UnregisterExecutor(taskID)
	t.Cleanup(func() { UnregisterExecutor(taskID) })

	first := &Executor{}
	second := &Executor{}

	if err := RegisterExecutor(taskID, first); err != nil {
		t.Fatalf("register first executor: %v", err)
	}
	if err := RegisterExecutor(taskID, second); err == nil {
		t.Fatalf("register second executor succeeded, want error")
	}
	if got := GetExecutor(taskID); got != first {
		t.Fatalf("registered executor was overwritten")
	}
}

func TestFinishAfterCancelRepairsRunningItems(t *testing.T) {
	setupEvaluatorTestStorage(t)

	task := &EvalTask{
		ID:         "task-cancel-running",
		Status:     TaskStatusRunning,
		TotalItems: 1,
		TimeoutMs:  1000,
	}
	if err := SaveTask(task); err != nil {
		t.Fatalf("save task: %v", err)
	}
	if err := SaveTestItem(&TestItem{
		ID:           task.ID + "-00000",
		TaskID:       task.ID,
		Index:        0,
		OriginalData: map[string]any{"prompt": "hello"},
		Status:       ItemStatusRunning,
	}); err != nil {
		t.Fatalf("save running item: %v", err)
	}

	executor := NewExecutor(task, &EvalProject{}, &EvaluatorTemplate{}, ExecutorCallbacks{})
	executor.Cancel()
	executor.finish()

	item, err := GetTestItem(task.ID, 0)
	if err != nil {
		t.Fatalf("get item: %v", err)
	}
	if item.Status != ItemStatusFailed {
		t.Fatalf("item status = %q, want failed", item.Status)
	}
	if item.LastError == "" {
		t.Fatalf("item LastError is empty, want cancellation reason")
	}

	runResult, err := GetRunResult(executor.runID)
	if err != nil {
		t.Fatalf("get run result: %v", err)
	}
	if !runResult.Aborted || runResult.Completed != 1 || runResult.Errors != 1 {
		t.Fatalf("run result = %+v, want aborted with one completed error", runResult)
	}
}

func TestPrepareTaskClearsOldTailItemsOnReprepare(t *testing.T) {
	setupEvaluatorTestStorage(t)
	cacheTestTemplate(t, &EvaluatorTemplate{
		ID:                   "tmpl-basic",
		EvaluatorType:        "basic",
		TargetPromptTemplate: "{{prompt}}",
	})

	taskID := "task-reprepare"
	if err := storage.Put([]byte(prefixSampleSet+"set-a"), []byte(`{"id":"set-a"}`)); err != nil {
		t.Fatalf("save sample set: %v", err)
	}
	for i := 0; i < 2; i++ {
		saveLocalSample(t, "set-a", i)
	}
	for i := 0; i < 5; i++ {
		if err := SaveTestItem(&TestItem{
			ID:     fmt.Sprintf("%s-%05d", taskID, i),
			TaskID: taskID,
			Index:  i,
			Status: ItemStatusPending,
		}); err != nil {
			t.Fatalf("save old item %d: %v", i, err)
		}
	}
	if err := SaveTask(&EvalTask{
		ID:            taskID,
		EvaluatorType: "basic",
		Status:        TaskStatusReady,
		DatasetConfig: DatasetConfig{LocalSampleSetIDs: []string{"set-a"}},
		Concurrency:   1,
		MaxRetries:    0,
		TimeoutMs:     1000,
	}); err != nil {
		t.Fatalf("save task: %v", err)
	}

	if err := doPrepareTask(context.Background(), taskID, PrepareCallbacks{}); err != nil {
		t.Fatalf("prepare task: %v", err)
	}

	items, total, err := ListTestItems(taskID, 0, 0)
	if err != nil {
		t.Fatalf("list items: %v", err)
	}
	if total != 2 || len(items) != 2 {
		t.Fatalf("items total=%d len=%d, want 2", total, len(items))
	}
	if _, err := GetTestItem(taskID, 2); err == nil {
		t.Fatalf("old tail item index 2 still exists")
	}
}

func TestEvaluatorLimitsAreAppliedBeforeLoadingAndExecution(t *testing.T) {
	setupEvaluatorTestStorage(t)

	if err := storage.Put([]byte(prefixSampleSet+"set-limit"), []byte(`{"id":"set-limit"}`)); err != nil {
		t.Fatalf("save sample set: %v", err)
	}
	for i := 0; i < 3; i++ {
		saveLocalSample(t, "set-limit", i)
	}

	items, err := LoadAllDatasetsLimited(DatasetConfig{LocalSampleSetIDs: []string{"set-limit"}}, nil, 2)
	if err != nil {
		t.Fatalf("load limited datasets: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("loaded items = %d, want 2", len(items))
	}

	task := &EvalTask{
		SampleCount: MaxEvalSampleCount + 1,
		Concurrency: MaxEvalConcurrency + 1,
		MaxRetries:  MaxEvalRetries + 1,
		TimeoutMs:   MaxEvalTimeoutMs + 1,
	}
	normalizeTaskLimits(task)
	if task.SampleCount != MaxEvalSampleCount {
		t.Fatalf("sample count = %d, want %d", task.SampleCount, MaxEvalSampleCount)
	}
	if task.Concurrency != MaxEvalConcurrency {
		t.Fatalf("concurrency = %d, want %d", task.Concurrency, MaxEvalConcurrency)
	}
	if task.MaxRetries != MaxEvalRetries {
		t.Fatalf("max retries = %d, want %d", task.MaxRetries, MaxEvalRetries)
	}
	if task.TimeoutMs != MaxEvalTimeoutMs {
		t.Fatalf("timeout = %d, want %d", task.TimeoutMs, MaxEvalTimeoutMs)
	}
}

func cacheTestTemplate(t *testing.T, template *EvaluatorTemplate) {
	t.Helper()

	templateCacheMu.Lock()
	oldCache := templateCache
	oldTime := templateCacheTime
	templateCache = map[string]*EvaluatorTemplate{template.EvaluatorType: template}
	templateCacheTime = time.Now()
	templateCacheMu.Unlock()

	t.Cleanup(func() {
		templateCacheMu.Lock()
		templateCache = oldCache
		templateCacheTime = oldTime
		templateCacheMu.Unlock()
	})
}

func saveLocalSample(t *testing.T, setID string, index int) {
	t.Helper()

	key := []byte(fmt.Sprintf("%s%s-%05d", prefixSample, setID, index))
	value := []byte(fmt.Sprintf(`{
		"id": "%s-%d",
		"generatedContent": "prompt %d",
		"category": "cat",
		"severity": "low",
		"tags": ["tag"]
	}`, setID, index, index))
	if err := storage.Put(key, value); err != nil {
		t.Fatalf("save sample %d: %v", index, err)
	}
}
