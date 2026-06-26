package yamlscan

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"lack-client/pkg/storage"

	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

const (
	keyPrefixScanResult  = "yamlscan:result:"
	keyPrefixScanHistory = "yamlscan:history:"
	maxGitHubFetchBytes  = 2 * 1024 * 1024
	maxYAMLContentBytes  = 2 * 1024 * 1024
)

var (
	// Reuse HTTP Client
	httpClient = &http.Client{
		Timeout:       30 * time.Second,
		CheckRedirect: checkGitHubRedirect,
	}

	storagePut = storage.Put

	// Precompiled GitHub URL conversion regex
	githubRawURLPatterns = []struct {
		pattern *regexp.Regexp
		replace string
	}{
		{
			pattern: regexp.MustCompile(`^https://github\.com/([^/]+)/([^/]+)/blob/([^/]+)/(.+)$`),
			replace: "https://raw.githubusercontent.com/$1/$2/$3/$4",
		},
		{
			pattern: regexp.MustCompile(`^https://github\.com/([^/]+)/([^/]+)/raw/([^/]+)/(.+)$`),
			replace: "https://raw.githubusercontent.com/$1/$2/$3/$4",
		},
	}
)

var allowedGitHubHosts = map[string]struct{}{
	"github.com":                {},
	"raw.githubusercontent.com": {},
}

// FetchFromGitHub fetches file content from GitHub URL.
func FetchFromGitHub(rawInput string) (string, error) {
	rawURL, err := normalizeGitHubRawURL(rawInput)
	if err != nil {
		return "", err
	}

	resp, err := httpClient.Get(rawURL)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.Request == nil {
		return "", errors.New("missing response request")
	}
	if err := validateGitHubResponseURL(resp.Request.URL); err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("request failed, status code: %d", resp.StatusCode)
	}

	body, err := readLimited(resp.Body, maxGitHubFetchBytes)
	if err != nil {
		return "", fmt.Errorf("read response failed: %w", err)
	}
	return string(body), nil
}

func normalizeGitHubRawURL(input string) (string, error) {
	if err := validateGitHubURL(input); err != nil {
		return "", err
	}

	rawURL := input
	for _, p := range githubRawURLPatterns {
		if p.pattern.MatchString(input) {
			rawURL = p.pattern.ReplaceAllString(input, p.replace)
			break
		}
	}
	if strings.HasPrefix(input, "https://raw.githubusercontent.com/") {
		rawURL = input
	}
	if err := validateGitHubURL(rawURL); err != nil {
		return "", err
	}
	return rawURL, nil
}

func validateGitHubURL(input string) error {
	parsed, err := url.Parse(input)
	if err != nil {
		return fmt.Errorf("invalid GitHub URL: %w", err)
	}
	if parsed.Scheme != "https" {
		return fmt.Errorf("GitHub URL must use https")
	}
	return validateGitHubResponseURL(parsed)
}

func validateGitHubResponseURL(u *url.URL) error {
	if u == nil {
		return errors.New("missing response URL")
	}
	if u.Scheme != "https" {
		return fmt.Errorf("GitHub URL must use https")
	}
	if _, ok := allowedGitHubHosts[strings.ToLower(u.Hostname())]; !ok {
		return fmt.Errorf("GitHub URL host %q is not allowed", u.Hostname())
	}
	return nil
}

func checkGitHubRedirect(req *http.Request, via []*http.Request) error {
	if len(via) >= 10 {
		return errors.New("stopped after 10 redirects")
	}
	return validateGitHubResponseURL(req.URL)
}

func readLimited(r io.Reader, maxBytes int64) ([]byte, error) {
	limited := io.LimitReader(r, maxBytes+1)
	body, err := io.ReadAll(limited)
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > maxBytes {
		return nil, fmt.Errorf("content exceeds %d byte limit", maxBytes)
	}
	return body, nil
}

// ValidateYAML validates YAML format.
func ValidateYAML(content string) error {
	if len(content) > maxYAMLContentBytes {
		return fmt.Errorf("YAML content exceeds %d byte limit", maxYAMLContentBytes)
	}
	var node yaml.Node
	decoder := yaml.NewDecoder(io.LimitReader(strings.NewReader(content), maxYAMLContentBytes+1))
	return decoder.Decode(&node)
}

// ScanYAML scans YAML content.
func ScanYAML(req ScanRequest) (ScanResult, error) {
	result := ScanResult{
		ID:        uuid.New().String(),
		ScannedAt: time.Now().Format(time.RFC3339),
		SourceURL: req.SourceURL,
		Findings:  []Finding{},
	}

	// Validate YAML format
	if err := ValidateYAML(req.Content); err != nil {
		result.Valid = false
		result.Safe = false
		result.Error = fmt.Sprintf("invalid YAML format: %s", err.Error())
		return result, nil
	}
	result.Valid = true

	// Parse to workflow structure
	workflow, structureFinding := parseWorkflow(req.Content)
	hasStructureIssue := structureFinding != nil

	lines := strings.Split(req.Content, "\n")
	result.Summary.TotalLines = len(lines)
	if structureFinding != nil {
		result.Findings = append(result.Findings, *structureFinding)
		result.Error = structureFinding.Description
	}

	// Execute 5 scanning rules
	result.Findings = append(result.Findings, scanRule1CorePattern(req.Content, &workflow)...)
	result.Findings = append(result.Findings, scanRule2GeminiCLI(req.Content, &workflow)...)
	result.Findings = append(result.Findings, scanRule3ClaudeMisconfig(req.Content)...)
	result.Findings = append(result.Findings, scanRule4CodexMisconfig(req.Content)...)
	result.Findings = append(result.Findings, scanRule5GitHubAIMisconfig(req.Content)...)

	// Stats
	for _, f := range result.Findings {
		switch f.Severity {
		case "critical":
			result.Summary.CriticalCount++
		case "high":
			result.Summary.HighCount++
		case "medium":
			result.Summary.MediumCount++
		case "low":
			result.Summary.LowCount++
		}
	}

	// Check if safe (no critical/high findings)
	result.Safe = !hasStructureIssue && result.Summary.CriticalCount == 0 && result.Summary.HighCount == 0

	// Save to Badger
	if err := saveResult(result); err != nil {
		result.Safe = false
		result.Error = fmt.Sprintf("save scan result failed: %s", err.Error())
		return result, err
	}

	return result, nil
}

func parseWorkflow(content string) (WorkflowFile, *Finding) {
	var workflow WorkflowFile
	if err := yaml.Unmarshal([]byte(content), &workflow); err != nil {
		return WorkflowFile{}, workflowStructureFinding(fmt.Sprintf("workflow structure parse failed: %s", err.Error()))
	}
	if strings.TrimSpace(content) == "" {
		return workflow, workflowStructureFinding("workflow structure parse failed: YAML document is empty")
	}
	var node yaml.Node
	if err := yaml.Unmarshal([]byte(content), &node); err != nil {
		return workflow, workflowStructureFinding(fmt.Sprintf("workflow structure parse failed: %s", err.Error()))
	}
	if !workflowNodeLooksValid(&node) {
		return workflow, workflowStructureFinding("workflow structure parse failed: expected a GitHub Actions workflow mapping with jobs")
	}
	return workflow, nil
}

func workflowNodeLooksValid(node *yaml.Node) bool {
	if node == nil || len(node.Content) == 0 {
		return false
	}
	doc := node.Content[0]
	if doc.Kind != yaml.MappingNode {
		return false
	}
	for i := 0; i+1 < len(doc.Content); i += 2 {
		if doc.Content[i].Value == "jobs" {
			return doc.Content[i+1].Kind == yaml.MappingNode
		}
	}
	return false
}

func workflowStructureFinding(reason string) *Finding {
	return &Finding{
		Line:        0,
		RuleID:      "WorkflowFile-StructureInvalid",
		Matched:     []string{"WorkflowFile"},
		Context:     reason,
		Severity:    "medium",
		Category:    "diagnostic",
		Description: reason,
		Suggestion:  "Provide a GitHub Actions workflow YAML file with a top-level jobs mapping so structured scan rules can run.",
	}
}

// saveResult saves scan result to Badger.
func saveResult(result ScanResult) error {
	resultData, err := json.Marshal(result)
	if err != nil {
		return err
	}
	resultKey := []byte(keyPrefixScanResult + result.ID)
	if err := storagePut(resultKey, resultData); err != nil {
		return err
	}

	history := ScanHistory{
		ID:            result.ID,
		SourceURL:     result.SourceURL,
		Safe:          result.Safe,
		CriticalCount: result.Summary.CriticalCount,
		HighCount:     result.Summary.HighCount,
		MediumCount:   result.Summary.MediumCount,
		LowCount:      result.Summary.LowCount,
		ScannedAt:     result.ScannedAt,
	}
	historyData, err := json.Marshal(history)
	if err != nil {
		return err
	}
	// Parse time for sort key
	scannedTime, _ := time.Parse(time.RFC3339, result.ScannedAt)
	historyKey := []byte(fmt.Sprintf("%s%020d:%s", keyPrefixScanHistory, ^scannedTime.UnixNano(), result.ID))
	return storagePut(historyKey, historyData)
}

// GetResult retrieves scan result.
func GetResult(id string) (*ScanResult, error) {
	key := []byte(keyPrefixScanResult + id)
	data, err := storage.Get(key)
	if err != nil {
		return nil, err
	}
	var result ScanResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ListHistory retrieves scan history list.
func ListHistory(offset, limit int) ([]ScanHistory, int, error) {
	total, err := storage.CountByPrefix([]byte(keyPrefixScanHistory))
	if err != nil {
		return nil, 0, err
	}

	items, err := storage.ListByPrefix([]byte(keyPrefixScanHistory), offset, limit)
	if err != nil {
		return nil, 0, err
	}

	histories := make([]ScanHistory, 0, len(items))
	for _, item := range items {
		var h ScanHistory
		if err := json.Unmarshal(item.Value, &h); err != nil {
			continue
		}
		histories = append(histories, h)
	}
	return histories, total, nil
}

// DeleteHistory deletes scan history.
func DeleteHistory(id string) error {
	result, err := GetResult(id)
	if err != nil {
		return err
	}

	resultKey := []byte(keyPrefixScanResult + id)
	if err := storage.Delete(resultKey); err != nil {
		return err
	}

	// Parse time for sort key
	scannedTime, _ := time.Parse(time.RFC3339, result.ScannedAt)
	historyKey := []byte(fmt.Sprintf("%s%020d:%s", keyPrefixScanHistory, ^scannedTime.UnixNano(), id))
	return storage.Delete(historyKey)
}

// ClearHistory clears all scan history.
func ClearHistory() error {
	items, err := storage.ListByPrefix([]byte(keyPrefixScanHistory), 0, 0)
	if err != nil {
		return err
	}

	keys := make([][]byte, 0, len(items)*2)
	for _, item := range items {
		var h ScanHistory
		if err := json.Unmarshal(item.Value, &h); err != nil {
			continue
		}
		keys = append(keys, item.Key)
		keys = append(keys, []byte(keyPrefixScanResult+h.ID))
	}
	return storage.DeleteBatch(keys)
}
