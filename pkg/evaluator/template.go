package evaluator

import (
	"encoding/json"
	"fmt"
	"reflect"
	"regexp"
	"strconv"
	"strings"
)

// Template placeholder regex
var (
	// {{variable}}, {{a.b}}, and {{choices[0]}} formats
	simplePlaceholderRe = regexp.MustCompile(`\{\{\s*([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+|\[[0-9]+\])*)\s*\}\}`)

	// {{#section}} start tag
	sectionStartRe = regexp.MustCompile(`\{\{#\s*([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+|\[[0-9]+\])*)\s*\}\}`)
)

// RenderTemplate renders the template by replacing placeholders.
// Supports:
// - {{variable}} - Simple variable replacement
// - {{a.b}} / {{choices[0]}} - Dotted paths and array indexes
// - {{#section}}...{{/section}} - Boolean section (displayed if variable exists and is not empty)
func RenderTemplate(template string, data map[string]any) string {
	if template == "" {
		return ""
	}

	result := template

	// 1. Process sections {{#section}}...{{/section}}
	result = processSections(result, data)

	// 2. Process simple variables {{variable}}
	result = simplePlaceholderRe.ReplaceAllStringFunc(result, func(match string) string {
		submatch := simplePlaceholderRe.FindStringSubmatch(match)
		if len(submatch) != 2 {
			return match
		}

		path := submatch[1]
		if val, ok := resolveTemplateValue(data, path); ok {
			return toString(val)
		}

		// Variable does not exist, keep original placeholder
		return match
	})

	return result
}

// processSections processes {{#section}}...{{/section}} blocks.
func processSections(template string, data map[string]any) string {
	result := template

	for {
		// Find start tag
		startMatch := sectionStartRe.FindStringSubmatchIndex(result)
		if startMatch == nil {
			break
		}

		varName := strings.TrimSpace(result[startMatch[2]:startMatch[3]])
		startTagEnd := startMatch[1]

		// Find corresponding end tag
		endTag := "{{/" + varName + "}}"
		endIdx := strings.Index(result[startTagEnd:], endTag)
		if endIdx == -1 {
			// End tag not found, skip
			break
		}

		// Extract content
		content := result[startTagEnd : startTagEnd+endIdx]
		fullEnd := startTagEnd + endIdx + len(endTag)

		// Check if variable exists and is not empty
		var replacement string
		if val, ok := resolveTemplateValue(data, varName); ok && !isEmpty(val) {
			// Recursively render internal content
			replacement = RenderTemplate(content, data)
		}

		// Replace entire block
		result = result[:startMatch[0]] + replacement + result[fullEnd:]
	}

	return result
}

func resolveTemplateValue(data map[string]any, path string) (any, bool) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, false
	}

	var current any = data
	for _, part := range strings.Split(path, ".") {
		if part == "" {
			return nil, false
		}

		name, rest := splitPathPart(part)
		if name != "" {
			next, ok := lookupTemplateField(current, name)
			if !ok {
				return nil, false
			}
			current = next
		}

		for rest != "" {
			if !strings.HasPrefix(rest, "[") {
				return nil, false
			}

			closeIdx := strings.Index(rest, "]")
			if closeIdx <= 1 {
				return nil, false
			}

			idx, err := strconv.Atoi(rest[1:closeIdx])
			if err != nil {
				return nil, false
			}

			next, ok := indexTemplateValue(current, idx)
			if !ok {
				return nil, false
			}
			current = next
			rest = rest[closeIdx+1:]
		}
	}

	return current, true
}

func splitPathPart(part string) (name, rest string) {
	bracketIdx := strings.Index(part, "[")
	if bracketIdx == -1 {
		return part, ""
	}
	return part[:bracketIdx], part[bracketIdx:]
}

func lookupTemplateField(current any, name string) (any, bool) {
	if current == nil {
		return nil, false
	}

	if m, ok := current.(map[string]any); ok {
		value, exists := m[name]
		return value, exists
	}

	value := reflect.ValueOf(current)
	if value.Kind() != reflect.Map || value.Type().Key().Kind() != reflect.String {
		return nil, false
	}

	field := value.MapIndex(reflect.ValueOf(name))
	if !field.IsValid() {
		return nil, false
	}

	return field.Interface(), true
}

func indexTemplateValue(current any, idx int) (any, bool) {
	if current == nil || idx < 0 {
		return nil, false
	}

	value := reflect.ValueOf(current)
	if value.Kind() != reflect.Slice && value.Kind() != reflect.Array {
		return nil, false
	}
	if idx >= value.Len() {
		return nil, false
	}

	return value.Index(idx).Interface(), true
}

// isEmpty checks if a value is empty.
func isEmpty(val any) bool {
	if val == nil {
		return true
	}

	switch v := val.(type) {
	case string:
		return strings.TrimSpace(v) == ""
	case []any:
		return len(v) == 0
	case []string:
		return len(v) == 0
	case map[string]any:
		return len(v) == 0
	case bool:
		return !v
	case int, int64, float64:
		return v == 0
	default:
		return false
	}
}

// toString converts a value to string.
func toString(val any) string {
	if val == nil {
		return ""
	}

	switch v := val.(type) {
	case string:
		return v
	case []string:
		return strings.Join(v, ", ")
	case []any:
		parts := make([]string, 0, len(v))
		for _, item := range v {
			parts = append(parts, toString(item))
		}
		return strings.Join(parts, ", ")
	case map[string]any:
		// JSON marshal
		b, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprintf("%v", v)
		}
		return string(b)
	case bool:
		if v {
			return "true"
		}
		return "false"
	case int:
		return fmt.Sprintf("%d", v)
	case int64:
		return fmt.Sprintf("%d", v)
	case float64:
		return fmt.Sprintf("%.2f", v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// GenerateTargetPrompt generates the prompt to send to the target model.
// Data should already have field mappings applied before calling this function.
func GenerateTargetPrompt(template *EvaluatorTemplate, data map[string]any) string {
	if template == nil || template.TargetPromptTemplate == "" {
		// No template, try standard "prompt" field first
		if prompt, ok := data["prompt"].(string); ok && prompt != "" {
			return prompt
		}
		// Fallback: infer prompt field from common field names
		if _, value := InferPromptField(data); value != "" {
			return value
		}
		return ""
	}

	return RenderTemplate(template.TargetPromptTemplate, data)
}

// GenerateEvalPrompt generates the prompt to send to the evaluation model.
func GenerateEvalPrompt(template *EvaluatorTemplate, data map[string]any, response string) string {
	if template == nil || template.EvalPromptTemplate == "" {
		return ""
	}

	// Copy data and add response
	evalData := make(map[string]any)
	for k, v := range data {
		evalData[k] = v
	}
	evalData["response"] = response

	return RenderTemplate(template.EvalPromptTemplate, evalData)
}

// ExtractMetadata extracts metadata from normalized data.
func ExtractMetadata(data map[string]any) (category, riskArea, expectedBehavior string) {
	if v, ok := data["category"].(string); ok {
		category = v
	}
	if v, ok := data["risk_area"].(string); ok {
		riskArea = v
	}
	if v, ok := data["expected_behavior"].(string); ok {
		expectedBehavior = v
	}
	return
}

// Common field names that are typically used as prompt/input
var commonPromptFields = []string{
	"prompt", "question", "instruction", "goal",
	"input", "query", "text", "content", "message",
	"user_input", "user_message", "request",
}

// InferPromptField attempts to find the prompt field from data.
// Returns the field name and value if found, empty strings otherwise.
func InferPromptField(data map[string]any) (fieldName string, value string) {
	for _, field := range commonPromptFields {
		if v, ok := data[field].(string); ok && v != "" {
			return field, v
		}
	}
	return "", ""
}

// ApplyFieldMappings applies field mappings to data, converting source fields to standard fields.
// mappings: source field -> standard field (e.g., {"question": "prompt"})
func ApplyFieldMappings(data map[string]any, mappings map[string]string) map[string]any {
	if len(mappings) == 0 {
		return data
	}

	result := make(map[string]any)
	// Copy original data
	for k, v := range data {
		result[k] = v
	}

	// Apply mappings: source -> standard
	for srcField, stdField := range mappings {
		if val, ok := data[srcField]; ok {
			result[stdField] = val
		}
	}

	return result
}

// GetAvailableFields returns all string fields from data for UI display.
func GetAvailableFields(data map[string]any) []string {
	var fields []string
	for k, v := range data {
		if _, ok := v.(string); ok {
			fields = append(fields, k)
		}
	}
	return fields
}
