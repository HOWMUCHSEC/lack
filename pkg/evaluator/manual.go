package evaluator

import (
	"context"
	"fmt"
)

// ManualEvalConfig contains the judge model connection used for an ad-hoc scan-response evaluation.
type ManualEvalConfig struct {
	BaseURL   string
	APIKey    string
	Model     string
	TimeoutMs int
}

// EvaluateManualResponse evaluates an already captured target response with the existing evaluator pipeline.
func EvaluateManualResponse(ctx context.Context, cfg ManualEvalConfig, template *EvaluatorTemplate, data map[string]any, response string) (*EvalResult, error) {
	if cfg.BaseURL == "" {
		return nil, fmt.Errorf("judge model base URL is required")
	}
	if cfg.Model == "" {
		return nil, fmt.Errorf("judge model name is required")
	}
	if template == nil || template.EvalPromptTemplate == "" {
		return nil, fmt.Errorf("evaluation template is required")
	}
	if ctx == nil {
		ctx = context.Background()
	}

	task := &EvalTask{
		ID:        "manual-scan-response-evaluation",
		TimeoutMs: cfg.TimeoutMs,
	}
	project := &EvalProject{
		EvalModel: EvalModelConfig{
			Provider: "openai-compatible",
			BaseURL:  cfg.BaseURL,
			APIKey:   cfg.APIKey,
			Model:    cfg.Model,
		},
	}
	executor := NewExecutor(task, project, template, ExecutorCallbacks{})
	executor.ctx = ctx

	evalPrompt := GenerateEvalPrompt(template, data, response)
	if evalPrompt == "" {
		return nil, fmt.Errorf("evaluation prompt is empty")
	}
	evalResponse, err := executor.callEvalModel(evalPrompt)
	if err != nil {
		return nil, err
	}
	result, err := executor.parseEvalResult(evalResponse)
	if err != nil {
		result.ParseError = err.Error()
		return result, err
	}
	return result, nil
}
