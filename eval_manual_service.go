package main

import (
	"context"
	"encoding/json"
	"fmt"
	"lack-client/pkg/evaluator"
	"lack-client/pkg/scanner"
	"lack-client/pkg/storage"
	"strconv"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type ManualScanStepEvaluationRequest struct {
	TaskID        string               `json:"taskId"`
	JudgeModelID  string               `json:"judgeModelId"`
	EvaluatorType string               `json:"evaluatorType"`
	TemplateID    string               `json:"templateId"`
	RequestField  string               `json:"requestField,omitempty"`
	ResponseField string               `json:"responseField,omitempty"`
	Steps         []scanner.StepResult `json:"steps"`
}

type ManualScanStepEvaluationResult struct {
	Index     int     `json:"index"`
	SampleID  string  `json:"sampleId"`
	Prompt    string  `json:"prompt"`
	Response  string  `json:"response"`
	Score     float64 `json:"score"`
	Label     string  `json:"label"`
	Reasoning string  `json:"reasoning"`
	Status    string  `json:"status"`
	Error     string  `json:"error,omitempty"`
}

type localJudgeTarget struct {
	ID          string             `json:"id"`
	TargetTitle string             `json:"target_title"`
	Metadata    localJudgeMetadata `json:"metadata"`
}

type localJudgeMetadata struct {
	BaseURL        string `json:"base_url"`
	RequestHeaders string `json:"request_headers"`
	ModelName      string `json:"model_name"`
	TimeoutMs      int    `json:"timeout_ms"`
}

// EvaluateScanSteps evaluates selected successful scanner responses with a configured judge model.
func (s *EvalService) EvaluateScanSteps(req ManualScanStepEvaluationRequest) ([]ManualScanStepEvaluationResult, error) {
	if strings.TrimSpace(req.JudgeModelID) == "" {
		return nil, fmt.Errorf("judge model id is required")
	}
	if strings.TrimSpace(req.EvaluatorType) == "" {
		return nil, fmt.Errorf("evaluator type is required")
	}
	if len(req.Steps) == 0 {
		return nil, fmt.Errorf("at least one scan step is required")
	}

	judge, err := loadLocalJudgeTarget(req.JudgeModelID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(judge.Metadata.BaseURL) == "" {
		return nil, fmt.Errorf("judge model base URL is required")
	}
	if strings.TrimSpace(judge.Metadata.ModelName) == "" {
		return nil, fmt.Errorf("judge model name is required")
	}

	template, err := evaluator.GetCachedTemplate(req.EvaluatorType)
	if err != nil {
		return nil, fmt.Errorf("load evaluator template %q: %w", req.EvaluatorType, err)
	}
	if req.TemplateID != "" && template.ID != "" && req.TemplateID != template.ID {
		return nil, fmt.Errorf("selected template id does not match evaluator type %q", req.EvaluatorType)
	}

	ctx := s.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	cfg := evaluator.ManualEvalConfig{
		BaseURL:   strings.TrimSpace(judge.Metadata.BaseURL),
		APIKey:    extractAPIKeyFromHeaders(judge.Metadata.RequestHeaders),
		Model:     strings.TrimSpace(judge.Metadata.ModelName),
		TimeoutMs: judge.Metadata.TimeoutMs,
	}

	results := make([]ManualScanStepEvaluationResult, 0, len(req.Steps))
	for i, step := range req.Steps {
		prompt := promptFromStep(step, req.RequestField)
		response := responseFromStep(step, req.ResponseField)
		row := ManualScanStepEvaluationResult{
			Index:    i,
			SampleID: fallbackSampleID(step.SampleID, i),
			Prompt:   prompt,
			Response: response,
			Status:   "running",
		}

		data := map[string]any{
			"prompt":       prompt,
			"request":      prompt,
			"request_body": firstNonEmpty(step.FinalRequest.BodyJSON, step.ReqPreview),
			"response":     response,
			"sample_id":    step.SampleID,
			"status_code":  step.StatusCode,
			"task_id":      step.TaskID,
			"run_id":       step.RunID,
		}

		result, err := evaluator.EvaluateManualResponse(ctx, cfg, template, data, response)
		if err != nil {
			row.Status = "failed"
			row.Error = err.Error()
			if result != nil {
				row.Score = result.Score
				row.Label = result.Label
				row.Reasoning = firstNonEmpty(result.Reasoning, result.ParseError, result.Raw)
			}
		} else {
			row.Status = "completed"
			row.Score = result.Score
			row.Label = result.Label
			row.Reasoning = result.Reasoning
		}
		results = append(results, row)
		s.emitManualEvalProgress(req.TaskID, i+1, len(req.Steps), row)
	}

	return results, nil
}

func (s *EvalService) emitManualEvalProgress(taskID string, completed, total int, result ManualScanStepEvaluationResult) {
	if s.ctx == nil {
		return
	}
	runtime.EventsEmit(s.ctx, "eval:manual:progress", map[string]any{
		"taskId":    taskID,
		"completed": completed,
		"total":     total,
		"result":    result,
	})
}

func loadLocalJudgeTarget(id string) (localJudgeTarget, error) {
	data, err := storage.Get([]byte("target:" + id))
	if err != nil || len(data) == 0 {
		return localJudgeTarget{}, fmt.Errorf("judge model not found: %s", id)
	}
	var target localJudgeTarget
	if err := json.Unmarshal(data, &target); err != nil {
		return localJudgeTarget{}, fmt.Errorf("parse judge model: %w", err)
	}
	return target, nil
}

func extractAPIKeyFromHeaders(headersJSON string) string {
	headersJSON = strings.TrimSpace(headersJSON)
	if headersJSON == "" {
		return ""
	}
	var headers map[string]string
	if err := json.Unmarshal([]byte(headersJSON), &headers); err != nil {
		return ""
	}
	for key, value := range headers {
		switch strings.ToLower(strings.TrimSpace(key)) {
		case "authorization":
			return stripBearerPrefix(value)
		case "api-key", "x-api-key":
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func stripBearerPrefix(value string) string {
	fields := strings.Fields(strings.TrimSpace(value))
	if len(fields) >= 2 && strings.EqualFold(fields[0], "Bearer") {
		return strings.Join(fields[1:], " ")
	}
	return strings.TrimSpace(value)
}

func promptFromStep(step scanner.StepResult, field string) string {
	raw := firstNonEmpty(step.FinalRequest.BodyJSON, step.ReqPreview)
	return extractFieldOrRaw(raw, field)
}

func responseFromStep(step scanner.StepResult, field string) string {
	raw := firstNonEmpty(step.ResponseBody, step.RespPreview)
	return extractFieldOrRaw(raw, field)
}

func extractFieldOrRaw(raw, field string) string {
	raw = strings.TrimSpace(raw)
	field = strings.TrimSpace(field)
	if raw == "" || field == "" {
		return raw
	}
	extracted, ok := extractJSONPath(raw, field)
	if !ok || strings.TrimSpace(extracted) == "" {
		return raw
	}
	return extracted
}

func extractJSONPath(raw, field string) (string, bool) {
	var current any
	if err := json.Unmarshal([]byte(raw), &current); err != nil {
		return "", false
	}
	for _, part := range splitJSONPath(field) {
		switch value := current.(type) {
		case map[string]any:
			next, ok := value[part]
			if !ok {
				return "", false
			}
			current = next
		case []any:
			idx, err := strconv.Atoi(part)
			if err != nil || idx < 0 || idx >= len(value) {
				return "", false
			}
			current = value[idx]
		default:
			return "", false
		}
	}
	return stringifyJSONValue(current), true
}

func splitJSONPath(path string) []string {
	path = strings.TrimSpace(path)
	path = strings.ReplaceAll(path, "[", ".")
	path = strings.ReplaceAll(path, "]", "")
	parts := strings.Split(path, ".")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func stringifyJSONValue(value any) string {
	if value == nil {
		return ""
	}
	if s, ok := value.(string); ok {
		return s
	}
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Sprintf("%v", value)
	}
	return string(data)
}

func fallbackSampleID(sampleID string, index int) string {
	if strings.TrimSpace(sampleID) != "" {
		return sampleID
	}
	return fmt.Sprintf("item-%d", index+1)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
