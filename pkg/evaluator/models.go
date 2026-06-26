// Package evaluator provides evaluation task management and execution.
package evaluator

// ============================================================
// Cloud Evaluator Templates
// ============================================================

// EvaluatorTemplate represents an evaluator template fetched from Supabase.
type EvaluatorTemplate struct {
	ID                   string                       `json:"id"`
	EvaluatorType        string                       `json:"evaluator_type"`
	Name                 string                       `json:"name"`
	NameZh               string                       `json:"name_zh"`
	Description          string                       `json:"description"`
	DescriptionZh        string                       `json:"description_zh"`
	Version              string                       `json:"version"`
	SupportedDatasets    []string                     `json:"supported_datasets"`
	FieldMappings        map[string]map[string]string `json:"field_mappings"` // datasetID -> {srcField: dstField}
	TargetPromptTemplate string                       `json:"target_prompt_template"`
	EvalPromptTemplate   string                       `json:"eval_prompt_template"`
	ResultSchema         map[string]string            `json:"result_schema"`
	Status               string                       `json:"status"`
	MinPlan              string                       `json:"min_plan"`
	CreatedAt            string                       `json:"created_at"`
	UpdatedAt            string                       `json:"updated_at"`
}

// EvaluatorInfo provides brief information about an evaluator (for list display).
type EvaluatorInfo struct {
	EvaluatorType     string   `json:"evaluatorType"`
	Name              string   `json:"name"`
	NameZh            string   `json:"nameZh"`
	Description       string   `json:"description"`
	DescriptionZh     string   `json:"descriptionZh"`
	Version           string   `json:"version"`
	SupportedDatasets []string `json:"supportedDatasets"`
	MinPlan           string   `json:"minPlan"`
}

// ============================================================
// Locally Stored Projects
// ============================================================

// EvalProject represents an evaluation project.
type EvalProject struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`

	// Target model configuration
	TargetModel TargetModelConfig `json:"targetModel"`

	// Evaluation model configuration
	EvalModel EvalModelConfig `json:"evalModel"`

	CreatedAt int64 `json:"createdAt"`
	UpdatedAt int64 `json:"updatedAt"`
}

// TargetModelConfig defines the configuration for the target model.
type TargetModelConfig struct {
	BaseURL string `json:"baseUrl"`
	APIKey  string `json:"apiKey"`
	Model   string `json:"model"`
}

// EvalModelConfig defines the configuration for the evaluation model.
type EvalModelConfig struct {
	Provider string `json:"provider"` // openai, anthropic, deepseek, etc.
	BaseURL  string `json:"baseUrl"`
	APIKey   string `json:"apiKey"`
	Model    string `json:"model"`
}

// ============================================================
// Locally Stored Evaluation Tasks
// ============================================================

// EvalTask represents an evaluation task.
type EvalTask struct {
	ID        string `json:"id"`
	ProjectID string `json:"projectId"`
	Name      string `json:"name"`

	// Evaluator
	EvaluatorType string `json:"evaluatorType"`
	TemplateID    string `json:"templateId,omitempty"` // ID of the template used

	// Dataset configuration
	DatasetConfig DatasetConfig `json:"datasetConfig"`

	// Execution parameters
	Concurrency int   `json:"concurrency"` // Concurrency level, default 5
	MaxRetries  int   `json:"maxRetries"`  // Max retries, default 3
	TimeoutMs   int   `json:"timeoutMs"`   // Timeout per request (ms), default 30000
	SampleCount int   `json:"sampleCount"` // Sample count, 0=all
	SampleSeed  int64 `json:"sampleSeed"`  // Random seed

	// Status
	Status       string `json:"status"` // pending, preparing, ready, running, paused, completed, failed
	TotalItems   int    `json:"totalItems"`
	PreparedAt   int64  `json:"preparedAt,omitempty"`
	ErrorMessage string `json:"errorMessage,omitempty"`

	CreatedAt int64 `json:"createdAt"`
	UpdatedAt int64 `json:"updatedAt"`
}

// Task status constants
const (
	TaskStatusPending   = "pending"
	TaskStatusPreparing = "preparing"
	TaskStatusReady     = "ready"
	TaskStatusRunning   = "running"
	TaskStatusPaused    = "paused"
	TaskStatusCompleted = "completed"
	TaskStatusFailed    = "failed"
)

// DatasetConfig defines the dataset configuration.
type DatasetConfig struct {
	// Local sample set IDs
	LocalSampleSetIDs []string `json:"localSampleSetIds,omitempty"`

	// Cloud downloaded sample set IDs
	CloudSampleSetIDs []string `json:"cloudSampleSetIds,omitempty"`

	// HuggingFace dataset references
	HfDatasets []HfDatasetRef `json:"hfDatasets,omitempty"`

	// Task-level field mappings: source field -> standard field
	// e.g., {"question": "prompt", "answer": "expected_output"}
	// Standard fields: prompt, context, expected_output, system_prompt
	FieldMappings map[string]string `json:"fieldMappings,omitempty"`
}

// HfDatasetRef represents a HuggingFace dataset reference.
type HfDatasetRef struct {
	RepoID string `json:"repoId"` // e.g., "LibrAI/do-not-answer"
	Config string `json:"config"` // Dataset config
	Split  string `json:"split"`  // train, test, validation
}

// ============================================================
// Test Items
// ============================================================

// TestItem represents a single test item.
type TestItem struct {
	ID     string `json:"id"`
	TaskID string `json:"taskId"`
	Index  int    `json:"index"` // Index

	// Data source traceability
	SourceType string `json:"sourceType"` // local, cloud, hf
	SourceID   string `json:"sourceId"`   // Original data ID

	// Normalized data
	OriginalData map[string]any `json:"originalData"` // Normalized original data
	TargetPrompt string         `json:"targetPrompt"` // Prompt sent to target model

	// Metadata extracted from original data
	Category         string `json:"category,omitempty"`
	RiskArea         string `json:"riskArea,omitempty"`
	ExpectedBehavior string `json:"expectedBehavior,omitempty"`

	// Execution status
	Status string `json:"status"` // pending, running, completed, failed

	// Results
	TargetResponse string      `json:"targetResponse,omitempty"` // Response from target model
	EvalPrompt     string      `json:"evalPrompt,omitempty"`     // Prompt sent to evaluation model
	EvalResult     *EvalResult `json:"evalResult,omitempty"`     // Evaluation result

	Attempts   int    `json:"attempts"`             // Attempts made
	LastError  string `json:"lastError,omitempty"`  // Last error
	DurationMs int64  `json:"durationMs,omitempty"` // Duration in ms

	CreatedAt int64 `json:"createdAt"`
	UpdatedAt int64 `json:"updatedAt"`
}

// TestItem status constants
const (
	ItemStatusPending   = "pending"
	ItemStatusRunning   = "running"
	ItemStatusCompleted = "completed"
	ItemStatusFailed    = "failed"
)

// EvalResult represents the evaluation result.
type EvalResult struct {
	// Common fields
	Score     float64 `json:"score"`     // Overall score 0-100
	Label     string  `json:"label"`     // pass, fail, partial
	Reasoning string  `json:"reasoning"` // Evaluation reasoning
	Raw       string  `json:"raw"`       // Raw JSON response

	// Safety related
	Refused bool `json:"refused,omitempty"` // Whether refused
	Safe    bool `json:"safe,omitempty"`    // Whether safe

	// JailbreakBench related
	Jailbroken bool `json:"jailbroken,omitempty"` // Whether jailbroken

	// AdvBench related
	AttackSucceeded bool `json:"attackSucceeded,omitempty"` // Whether attack succeeded

	// SafetyBench related
	Harmless bool `json:"harmless,omitempty"` // Harmless
	Helpful  bool `json:"helpful,omitempty"`  // Helpful
	Honest   bool `json:"honest,omitempty"`   // Honest
	Ethical  bool `json:"ethical,omitempty"`  // Ethical

	// TruthfulQA related
	Truthful    bool `json:"truthful,omitempty"`    // Truthful
	Informative bool `json:"informative,omitempty"` // Informative

	// Template schema aliases
	IsCorrect    bool    `json:"isCorrect,omitempty"`    // Correctness-style evaluator result
	IsTruthful   bool    `json:"isTruthful,omitempty"`   // Truthfulness alias used by newer templates
	SafetyScore  float64 `json:"safetyScore,omitempty"`  // Safety score alias
	OverallScore float64 `json:"overallScore,omitempty"` // Overall score alias

	// Parse error
	ParseError string `json:"parseError,omitempty"`
}

// ============================================================
// Run Results
// ============================================================

// EvalRunResult represents the summary of an evaluation run.
type EvalRunResult struct {
	RunID      string `json:"runId"`
	TaskID     string `json:"taskId"`
	StartedAt  int64  `json:"startedAt"`
	FinishedAt int64  `json:"finishedAt"`

	// Statistics
	Total     int `json:"total"`
	Completed int `json:"completed"`
	Passed    int `json:"passed"`
	Failed    int `json:"failed"`
	Errors    int `json:"errors"`

	// Status
	Aborted bool   `json:"aborted"`
	Error   string `json:"error,omitempty"`

	// Aggregated metrics
	AvgScore   float64 `json:"avgScore"`
	PassRate   float64 `json:"passRate"`
	RefuseRate float64 `json:"refuseRate,omitempty"`
}

// ============================================================
// Data Loading
// ============================================================

// NormalizedItem represents a normalized data item (for loading).
type NormalizedItem struct {
	SourceType string         `json:"sourceType"` // local, cloud, hf
	SourceID   string         `json:"sourceId"`   // Original ID
	Data       map[string]any `json:"data"`       // Normalized data
}

// ============================================================
// List Results
// ============================================================

// ListResult represents a generic list result.
type ListResult struct {
	Items   interface{} `json:"items"`
	Total   int         `json:"total"`
	HasMore bool        `json:"hasMore"`
}
