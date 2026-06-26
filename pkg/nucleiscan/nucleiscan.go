package nucleiscan

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"lack-client/pkg/logger"
	"lack-client/pkg/storage"

	nuclei "github.com/projectdiscovery/nuclei/v3/lib"
	"github.com/projectdiscovery/nuclei/v3/pkg/output"
	"gopkg.in/yaml.v3"
)

// EmbeddedTemplates embedded nuclei template files.
// Set by main.go or other entry points.
var EmbeddedTemplates fs.FS

// TemplatesDir directory name for templates.
const TemplatesDir = "nuclei-templates"

const (
	// TemplatesDirEnv allows overriding the template source directory.
	TemplatesDirEnv = "LACK_NUCLEI_TEMPLATES_DIR"
	// ExternalTemplatesOptInEnv must be enabled before external template directories are used.
	ExternalTemplatesOptInEnv = "LACK_NUCLEI_ALLOW_EXTERNAL_TEMPLATES"
	// DefaultExternalTemplatesDir points to a full nuclei-templates checkout in dev.
	DefaultExternalTemplatesDir = "tmp-nuclei-templates"
	// TemplateFilterModeEnv is kept for compatibility; default scans always use the AI/LLM allowlist.
	TemplateFilterModeEnv = "LACK_NUCLEI_TEMPLATE_FILTER_MODE"
)

const (
	TemplateFilterModeAI  = "ai-llm"
	TemplateFilterModeAll = "all"
)

const aiTemplateAllowlistPath = "profiles/ai-llm.yaml"

const (
	defaultScanConcurrency = 10
	defaultScanRateLimit   = 150
	defaultScanTimeout     = 30
	defaultScanRetries     = 1
	defaultMaxHostError    = 30
	maxScanTargets         = 256
	maxScanConcurrency     = 100
	maxScanRateLimit       = 1000
	maxScanTimeout         = 120
	maxNucleiResultDetails = 500
	maxRecentRunsLimit     = 100
	maxTemplateSelectors   = 512
	maxTemplateSelectorLen = 512
)

var aiTemplateKeywords = []string{
	"ai-ml",
	"llm",
	"ollama",
	"litellm",
	"lite-llm",
	"anything-llm",
	"anythingllm",
	"openwebui",
	"open-webui",
	"localai",
	"vllm",
	"gradio",
	"jupyter",
	"jupyterhub",
	"jupyter-lab",
	"jupyterlab",
	"qdrant",
	"milvus",
	"weaviate",
	"chroma",
	"chromadb",
	"mlflow",
	"tensorboard",
	"triton",
	"flowise",
	"langflow",
	"privategpt",
	"private-gpt",
	"dify",
	"google-adk",
	"langchain",
	"huggingface",
	"openai",
	"anthropic",
	"comfyui",
	"comfy-ui",
	"automatic1111",
	"stable-diffusion",
	"invokeai",
	"fastchat",
	"llama",
	"kobold",
	"text-generation-webui",
	"oobabooga",
	"h2ogpt",
	"ragflow",
	"vector-db",
	"vector database",
	"pgvector",
	"pinecone",
	"redis",
	"opensearch",
	"elasticsearch",
	"kibana",
	"neo4j",
	"minio",
	"mongodb",
	"mongo-express",
	"anyscale ray",
	"ray dashboard",
	"ray api",
	"ray static file",
	"ray_project",
	"airflow",
	"prefect",
	"kubeflow",
	"dataiku",
	"spark",
	"streamlit",
	"seldon",
	"kserve",
	"bentoml",
	"grafana",
	"prometheus",
	"harbor",
	"gitlab",
	"jenkins",
	"portainer",
	"lollms",
}

type templateEntry struct {
	Info    TemplateInfo
	RelPath string
	AbsPath string
}

// ScanConfig scan configuration.
type ScanConfig struct {
	TaskID      string   `json:"taskID"`      // Task ID
	Targets     []string `json:"targets"`     // List of scan targets (URLs/IPs)
	Templates   []string `json:"templates"`   // Specific template IDs / paths (empty means use default filter profile)
	Concurrency int      `json:"concurrency"` // Concurrency level
	RateLimit   int      `json:"rateLimit"`   // Requests per second limit
	Timeout     int      `json:"timeout"`     // Timeout in seconds
}

// ScanResult scan result.
type ScanResult struct {
	RunID      string         `json:"runID"`
	TaskID     string         `json:"taskID"`
	StartedAt  int64          `json:"startedAt"`
	FinishedAt int64          `json:"finishedAt"`
	Total      int            `json:"total"`
	Findings   int            `json:"findings"`
	Errors     int            `json:"errors"`
	Aborted    bool           `json:"aborted"`
	Results    []FindingEvent `json:"results,omitempty"`
}

// FindingEvent single finding event.
type FindingEvent struct {
	RunID            string            `json:"runID"`
	TaskID           string            `json:"taskID"`
	TemplateID       string            `json:"templateID"`
	TemplateName     string            `json:"templateName"`
	Severity         string            `json:"severity"`
	Host             string            `json:"host"`
	Matched          string            `json:"matched"`
	ExtractedResults []string          `json:"extractedResults,omitempty"`
	Timestamp        int64             `json:"timestamp"`
	Metadata         map[string]string `json:"metadata,omitempty"`
}

// TemplateInfo template information.
type TemplateInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Author      string `json:"author"`
	Severity    string `json:"severity"`
	Description string `json:"description"`
	Tags        string `json:"tags"`
	FilePath    string `json:"filePath"`
}

// Callbacks runtime callbacks.
type Callbacks struct {
	OnStarted  func(runID string, total int)
	OnFinding  func(event FindingEvent)
	OnFinished func(summary ScanResult)
}

// extractTemplatesFromEmbed extracts embedded templates to a temporary directory.
func extractTemplatesFromEmbed() (string, error) {
	if EmbeddedTemplates == nil {
		return "", fmt.Errorf("embedded nuclei templates are not configured")
	}

	// Create temporary directory
	tmpDir, err := os.MkdirTemp("", "nuclei-templates-*")
	if err != nil {
		return "", fmt.Errorf("failed to create temp dir: %w", err)
	}

	// Walk embedded files and extract
	err = fs.WalkDir(EmbeddedTemplates, TemplatesDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Calculate target path
		relPath := strings.TrimPrefix(path, TemplatesDir)
		if relPath == "" {
			return nil
		}
		relPath = strings.TrimPrefix(relPath, "/")
		targetPath := filepath.Join(tmpDir, relPath)

		if d.IsDir() {
			return os.MkdirAll(targetPath, 0755)
		}

		// Read embedded file content
		content, err := fs.ReadFile(EmbeddedTemplates, path)
		if err != nil {
			return fmt.Errorf("failed to read embedded file %s: %w", path, err)
		}

		// Write to temporary directory
		if err := os.WriteFile(targetPath, content, 0644); err != nil {
			return fmt.Errorf("failed to write file %s: %w", targetPath, err)
		}

		return nil
	})

	if err != nil {
		os.RemoveAll(tmpDir)
		return "", fmt.Errorf("failed to extract templates: %w", err)
	}

	return tmpDir, nil
}

func isTemplateFile(path string) bool {
	lower := strings.ToLower(path)
	return strings.HasSuffix(lower, ".yaml") || strings.HasSuffix(lower, ".yml")
}

func templateRelPath(root, filePath string) string {
	root = filepath.ToSlash(strings.TrimSpace(root))
	filePath = filepath.ToSlash(filePath)
	if root == "" || root == "." {
		return strings.TrimPrefix(filePath, "./")
	}

	prefix := strings.TrimSuffix(root, "/") + "/"
	if strings.HasPrefix(filePath, prefix) {
		return strings.TrimPrefix(filePath, prefix)
	}
	return strings.TrimPrefix(filePath, "./")
}

func hasHiddenPathSegment(relPath string) bool {
	for _, part := range strings.Split(filepath.ToSlash(relPath), "/") {
		if strings.HasPrefix(part, ".") {
			return true
		}
	}
	return false
}

func isTemplateCandidatePath(relPath string) bool {
	relPath = strings.TrimPrefix(filepath.ToSlash(relPath), "./")
	if relPath == "" || relPath == "." || !isTemplateFile(relPath) {
		return false
	}
	if hasHiddenPathSegment(relPath) {
		return false
	}
	return !strings.HasPrefix(relPath, "profiles/")
}

func hasTemplateMetadata(info TemplateInfo) bool {
	return strings.TrimSpace(info.ID) != "" && strings.TrimSpace(info.Name) != ""
}

func listTemplateEntriesFromFS(fsys fs.FS, root string, toAbs func(relPath string) string) ([]templateEntry, error) {
	entries := make([]templateEntry, 0, 128)

	err := fs.WalkDir(fsys, root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return fmt.Errorf("failed to walk template path %s: %w", path, walkErr)
		}

		if d.IsDir() {
			return nil
		}

		relPath := templateRelPath(root, path)
		if !isTemplateCandidatePath(relPath) {
			return nil
		}

		content, readErr := fs.ReadFile(fsys, path)
		if readErr != nil {
			return fmt.Errorf("failed to read template %s: %w", relPath, readErr)
		}

		info := parseTemplateInfo(string(content), relPath)
		if !hasTemplateMetadata(info) {
			return nil
		}

		entries = append(entries, templateEntry{
			Info:    info,
			RelPath: relPath,
			AbsPath: toAbs(relPath),
		})
		return nil
	})
	if err != nil {
		return nil, err
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].RelPath < entries[j].RelPath
	})
	return entries, nil
}

func listTemplateEntriesFromDir(dir string) ([]templateEntry, error) {
	fsys := os.DirFS(dir)
	return listTemplateEntriesFromFS(fsys, ".", func(relPath string) string {
		return filepath.Join(dir, filepath.FromSlash(relPath))
	})
}

func listTemplateEntriesFromEmbed() ([]templateEntry, error) {
	if EmbeddedTemplates == nil {
		return nil, fmt.Errorf("embedded nuclei templates are not configured")
	}
	return listTemplateEntriesFromFS(EmbeddedTemplates, TemplatesDir, func(relPath string) string {
		// Embedded templates are extracted for scan-time execution.
		return ""
	})
}

func hasYAMLTemplates(dir string) bool {
	found := false
	_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			return nil
		}
		relPath, relErr := filepath.Rel(dir, path)
		if relErr != nil {
			relPath = path
		}
		if isTemplateCandidatePath(relPath) {
			found = true
			return errors.New("found")
		}
		return nil
	})
	return found
}

func externalTemplatesAllowed() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(ExternalTemplatesOptInEnv))) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}

func validTemplatesDir(candidate string) string {
	abs, err := validateTemplatesDir(candidate)
	if err != nil {
		return ""
	}
	return abs
}

func validateTemplatesDir(candidate string) (string, error) {
	candidate = strings.TrimSpace(candidate)
	if candidate == "" {
		return "", fmt.Errorf("templates directory is empty")
	}
	abs, err := filepath.Abs(candidate)
	if err != nil {
		return "", fmt.Errorf("failed to resolve templates directory %q: %w", candidate, err)
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", fmt.Errorf("templates directory %q is not accessible: %w", abs, err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("templates path %q is not a directory", abs)
	}
	if !hasYAMLTemplates(abs) {
		return "", fmt.Errorf("templates directory %q does not contain usable nuclei YAML templates", abs)
	}
	return abs, nil
}

func configuredTemplatesDir() (string, bool, error) {
	fromEnv := strings.TrimSpace(os.Getenv(TemplatesDirEnv))
	if fromEnv == "" {
		return "", false, nil
	}
	if !externalTemplatesAllowed() {
		return "", true, fmt.Errorf("%s requires %s=1 to use external nuclei templates", TemplatesDirEnv, ExternalTemplatesOptInEnv)
	}
	dir, err := validateTemplatesDir(fromEnv)
	if err != nil {
		return "", true, fmt.Errorf("%s is invalid: %w", TemplatesDirEnv, err)
	}
	return dir, true, nil
}

func findConfiguredTemplatesDir() string {
	dir, configured, err := configuredTemplatesDir()
	if !configured || err != nil {
		return ""
	}
	return dir
}

func findDefaultExternalTemplatesDir() string {
	if !externalTemplatesAllowed() {
		return ""
	}
	return validTemplatesDir(DefaultExternalTemplatesDir)
}

// ListEmbeddedTemplates lists template metadata from active nuclei template source.
// Priority:
// 1) LACK_NUCLEI_TEMPLATES_DIR when LACK_NUCLEI_ALLOW_EXTERNAL_TEMPLATES=1
// 2) embedded nuclei-templates
// 3) ./tmp-nuclei-templates only when embedded templates are unavailable and external templates are allowed
func ListEmbeddedTemplates() ([]TemplateInfo, error) {
	var (
		entries []templateEntry
		err     error
	)

	if externalDir, configured, cfgErr := configuredTemplatesDir(); configured {
		if cfgErr != nil {
			return nil, cfgErr
		}
		entries, err = listTemplateEntriesFromDir(externalDir)
	} else {
		entries, err = listTemplateEntriesFromEmbed()
		if err != nil {
			if fallbackDir := findDefaultExternalTemplatesDir(); fallbackDir != "" {
				logger.Warn("embedded nuclei templates unavailable; using fallback external templates", "dir", fallbackDir, "error", err)
				entries, err = listTemplateEntriesFromDir(fallbackDir)
			}
		}
	}
	if err != nil {
		return nil, err
	}

	templates := make([]TemplateInfo, 0, len(entries))
	for _, entry := range entries {
		templates = append(templates, entry.Info)
	}
	return templates, nil
}

// parseTemplateInfo parses template basic info from YAML content.
func parseTemplateInfo(content, filePath string) TemplateInfo {
	info := TemplateInfo{FilePath: filePath}

	lines := strings.Split(content, "\n")
	inInfo := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if strings.HasPrefix(trimmed, "id:") {
			info.ID = strings.TrimSpace(strings.TrimPrefix(trimmed, "id:"))
		}

		if trimmed == "info:" {
			inInfo = true
			continue
		}

		if inInfo {
			if strings.HasPrefix(trimmed, "name:") {
				info.Name = strings.TrimSpace(strings.TrimPrefix(trimmed, "name:"))
			} else if strings.HasPrefix(trimmed, "author:") {
				info.Author = strings.TrimSpace(strings.TrimPrefix(trimmed, "author:"))
			} else if strings.HasPrefix(trimmed, "severity:") {
				info.Severity = strings.TrimSpace(strings.TrimPrefix(trimmed, "severity:"))
			} else if strings.HasPrefix(trimmed, "description:") {
				info.Description = strings.TrimSpace(strings.TrimPrefix(trimmed, "description:"))
			} else if strings.HasPrefix(trimmed, "tags:") {
				info.Tags = strings.TrimSpace(strings.TrimPrefix(trimmed, "tags:"))
			} else if !strings.HasPrefix(trimmed, " ") && !strings.HasPrefix(trimmed, "\t") && trimmed != "" && !strings.HasPrefix(trimmed, "-") {
				// Exit info block on non-indented line that is not a list item
				if !strings.HasPrefix(line, " ") && !strings.HasPrefix(line, "\t") {
					inInfo = false
				}
			}
		}
	}

	return info
}

func defaultTemplateFilterMode() string {
	mode := strings.ToLower(strings.TrimSpace(os.Getenv(TemplateFilterModeEnv)))
	switch mode {
	case "", "ai", TemplateFilterModeAI, TemplateFilterModeAll:
		return TemplateFilterModeAI
	default:
		// Unknown mode: stay safe and focused by defaulting to AI profile.
		return TemplateFilterModeAI
	}
}

func isAIRelevantTemplate(info TemplateInfo) bool {
	joined := strings.ToLower(strings.Join([]string{
		info.ID,
		info.Name,
		info.Description,
		info.Tags,
		info.FilePath,
	}, " "))
	for _, kw := range aiTemplateKeywords {
		if containsTemplateKeyword(joined, kw) {
			return true
		}
	}
	return false
}

func containsTemplateKeyword(text, keyword string) bool {
	text = strings.ToLower(text)
	keyword = strings.ToLower(strings.TrimSpace(keyword))
	if keyword == "" {
		return false
	}

	if hasKeywordSeparator(keyword) {
		return strings.Contains(text, keyword)
	}

	start := 0
	for {
		idx := strings.Index(text[start:], keyword)
		if idx < 0 {
			return false
		}
		idx += start
		before := idx == 0 || !isKeywordChar(text[idx-1])
		afterIdx := idx + len(keyword)
		after := afterIdx >= len(text) || !isKeywordChar(text[afterIdx])
		if before && after {
			return true
		}
		start = idx + 1
	}
}

func hasKeywordSeparator(keyword string) bool {
	for i := 0; i < len(keyword); i++ {
		if !isKeywordChar(keyword[i]) {
			return true
		}
	}
	return false
}

func isKeywordChar(ch byte) bool {
	return (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')
}

type templateAllowlist struct {
	Templates []string `yaml:"templates"`
}

func loadEmbeddedAIAllowlist() ([]string, error) {
	path := filepath.ToSlash(filepath.Join(TemplatesDir, aiTemplateAllowlistPath))
	if EmbeddedTemplates == nil {
		logger.Warn("embedded AI template allowlist unavailable; using builtin compatibility allowlist", "path", path, "error", "embedded nuclei templates are not configured")
		return copyBuiltinAIAllowlist(), nil
	}
	b, err := fs.ReadFile(EmbeddedTemplates, path)
	if err != nil {
		logger.Warn("embedded AI template allowlist unavailable; using builtin compatibility allowlist", "path", path, "error", err)
		return copyBuiltinAIAllowlist(), nil
	}

	var cfg templateAllowlist
	if err := yaml.Unmarshal(b, &cfg); err != nil {
		return nil, err
	}

	out := make([]string, 0, len(cfg.Templates))
	for _, t := range cfg.Templates {
		if s := strings.TrimSpace(t); s != "" {
			out = append(out, filepath.ToSlash(s))
		}
	}
	return out, nil
}

var loadAIAllowlist = loadEmbeddedAIAllowlist

func copyBuiltinAIAllowlist() []string {
	out := make([]string, len(builtinAITemplateAllowlist))
	copy(out, builtinAITemplateAllowlist)
	return out
}

func summarizePaths(paths []string, limit int) string {
	if len(paths) <= limit {
		return strings.Join(paths, ", ")
	}
	return fmt.Sprintf("%s (+%d more)", strings.Join(paths[:limit], ", "), len(paths)-limit)
}

func selectTemplatesByAllowlist(entries []templateEntry, allowlist []string) ([]templateEntry, []string) {
	byRelPath := make(map[string]templateEntry, len(entries))
	for _, entry := range entries {
		byRelPath[strings.ToLower(filepath.ToSlash(entry.RelPath))] = entry
	}

	selected := make([]templateEntry, 0, len(allowlist))
	missing := make([]string, 0)
	seen := make(map[string]struct{}, len(allowlist))
	for _, rel := range allowlist {
		rel = strings.TrimSpace(rel)
		if rel == "" {
			continue
		}
		key := strings.ToLower(filepath.ToSlash(rel))
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}

		entry, ok := byRelPath[key]
		if !ok {
			missing = append(missing, rel)
			continue
		}
		selected = append(selected, entry)
	}
	return selected, missing
}

func templateEntryRelPaths(entries []templateEntry) []string {
	paths := make([]string, 0, len(entries))
	for _, entry := range entries {
		paths = append(paths, entry.RelPath)
	}
	return paths
}

func addUniqueTemplateEntry(out []templateEntry, seen map[string]struct{}, entry templateEntry) []templateEntry {
	key := strings.ToLower(filepath.ToSlash(entry.RelPath))
	if _, ok := seen[key]; ok {
		return out
	}
	seen[key] = struct{}{}
	return append(out, entry)
}

func selectDefaultAITemplates(entries []templateEntry) []templateEntry {
	selected := make([]templateEntry, 0, len(entries))
	seen := make(map[string]struct{}, len(entries))

	allowlist, err := loadAIAllowlist()
	if err != nil {
		logger.Warn("AI template allowlist unavailable; using builtin compatibility allowlist", "error", err)
		allowlist = copyBuiltinAIAllowlist()
	}
	if len(allowlist) == 0 {
		logger.Warn("AI template allowlist is empty; using builtin compatibility allowlist")
		allowlist = copyBuiltinAIAllowlist()
	}

	allowlisted, missing := selectTemplatesByAllowlist(entries, allowlist)
	for _, entry := range allowlisted {
		selected = addUniqueTemplateEntry(selected, seen, entry)
	}
	if len(missing) > 0 {
		logger.Warn("AI template allowlist references unavailable templates; skipping missing entries", "missing", summarizePaths(missing, 10))
	}

	return selected
}

func selectTemplatesForScan(entries []templateEntry, selectors []string) ([]templateEntry, error) {
	if len(entries) == 0 {
		return nil, fmt.Errorf("no nuclei templates available")
	}

	byID := make(map[string]templateEntry, len(entries))
	byRelPath := make(map[string]templateEntry, len(entries))
	byBaseName := make(map[string][]templateEntry, len(entries))
	for _, entry := range entries {
		if id := strings.TrimSpace(entry.Info.ID); id != "" {
			byID[strings.ToLower(id)] = entry
		}
		relKey := strings.ToLower(filepath.ToSlash(entry.RelPath))
		byRelPath[relKey] = entry
		baseKey := strings.ToLower(filepath.Base(relKey))
		byBaseName[baseKey] = append(byBaseName[baseKey], entry)
	}

	addUnique := func(out []templateEntry, seen map[string]struct{}, entry templateEntry) []templateEntry {
		key := strings.ToLower(filepath.ToSlash(entry.RelPath))
		if _, ok := seen[key]; ok {
			return out
		}
		seen[key] = struct{}{}
		return append(out, entry)
	}

	if len(selectors) > 0 {
		selected := make([]templateEntry, 0, len(selectors))
		seen := make(map[string]struct{}, len(selectors))
		unmatched := make([]string, 0)
		ambiguous := make([]string, 0)
		seenInvalid := make(map[string]struct{}, len(selectors))
		for _, raw := range selectors {
			sel := strings.TrimSpace(raw)
			if sel == "" {
				continue
			}
			key := strings.ToLower(filepath.ToSlash(sel))
			if entry, ok := byID[key]; ok {
				selected = addUnique(selected, seen, entry)
				continue
			}
			if entry, ok := byRelPath[key]; ok {
				selected = addUnique(selected, seen, entry)
				continue
			}
			if matches := byBaseName[key]; len(matches) == 1 {
				selected = addUnique(selected, seen, matches[0])
				continue
			} else if len(matches) > 1 {
				if _, exists := seenInvalid["ambiguous:"+key]; !exists {
					seenInvalid["ambiguous:"+key] = struct{}{}
					ambiguous = append(ambiguous, fmt.Sprintf("%s matches %s", sel, summarizePaths(templateEntryRelPaths(matches), 5)))
				}
				continue
			}

			if _, exists := seenInvalid["unmatched:"+key]; !exists {
				seenInvalid["unmatched:"+key] = struct{}{}
				unmatched = append(unmatched, sel)
			}
		}

		if len(unmatched) > 0 || len(ambiguous) > 0 {
			problems := make([]string, 0, 2)
			if len(unmatched) > 0 {
				problems = append(problems, fmt.Sprintf("unmatched selectors: %s", summarizePaths(unmatched, 10)))
			}
			if len(ambiguous) > 0 {
				problems = append(problems, fmt.Sprintf("ambiguous selectors: %s", summarizePaths(ambiguous, 5)))
			}
			return nil, fmt.Errorf("invalid requested templates: %s", strings.Join(problems, "; "))
		}
		if len(selected) == 0 {
			return nil, fmt.Errorf("none of the requested templates matched available templates")
		}
		return selected, nil
	}

	// AI-focused default profile. Keep this strict so default scans only run
	// the curated AI/LLM template set embedded in the product.
	selected := selectDefaultAITemplates(entries)
	if len(selected) == 0 {
		return nil, fmt.Errorf("AI template profile selected 0 templates; refusing to run all %d templates by default", len(entries))
	}
	return selected, nil
}

func prepareTemplateEntriesForScan() (entries []templateEntry, cleanup func(), err error) {
	if externalDir, configured, cfgErr := configuredTemplatesDir(); configured {
		if cfgErr != nil {
			return nil, nil, cfgErr
		}
		entries, err = listTemplateEntriesFromDir(externalDir)
		if err != nil {
			return nil, nil, err
		}
		return entries, func() {}, nil
	}

	tmpDir, err := extractTemplatesFromEmbed()
	if err != nil {
		if fallbackDir := findDefaultExternalTemplatesDir(); fallbackDir != "" {
			logger.Warn("embedded nuclei templates unavailable; using fallback external templates", "dir", fallbackDir, "error", err)
			entries, err = listTemplateEntriesFromDir(fallbackDir)
			if err != nil {
				return nil, nil, err
			}
			return entries, func() {}, nil
		}
		return nil, nil, err
	}

	entries, err = listTemplateEntriesFromDir(tmpDir)
	if err != nil {
		_ = os.RemoveAll(tmpDir)
		if fallbackDir := findDefaultExternalTemplatesDir(); fallbackDir != "" {
			logger.Warn("extracted embedded nuclei templates unavailable; using fallback external templates", "dir", fallbackDir, "error", err)
			entries, err = listTemplateEntriesFromDir(fallbackDir)
			if err != nil {
				return nil, nil, err
			}
			return entries, func() {}, nil
		}
		return nil, nil, err
	}

	return entries, func() { _ = os.RemoveAll(tmpDir) }, nil
}

func normalizeScanConfig(cfg ScanConfig) (ScanConfig, error) {
	targets := make([]string, 0, len(cfg.Targets))
	for _, target := range cfg.Targets {
		target = strings.TrimSpace(target)
		if target != "" {
			targets = append(targets, target)
		}
	}
	cfg.Targets = targets

	if len(cfg.Targets) == 0 {
		return cfg, fmt.Errorf("no targets specified")
	}
	if len(cfg.Targets) > maxScanTargets {
		return cfg, fmt.Errorf("too many targets: got %d, max %d", len(cfg.Targets), maxScanTargets)
	}
	if len(cfg.Templates) > maxTemplateSelectors {
		return cfg, fmt.Errorf("too many template selectors: got %d, max %d", len(cfg.Templates), maxTemplateSelectors)
	}
	templates := make([]string, 0, len(cfg.Templates))
	for _, template := range cfg.Templates {
		template = strings.TrimSpace(template)
		if template == "" {
			continue
		}
		if len(template) > maxTemplateSelectorLen {
			return cfg, fmt.Errorf("template selector exceeds hard limit: got %d bytes, max %d", len(template), maxTemplateSelectorLen)
		}
		templates = append(templates, template)
	}
	cfg.Templates = templates
	if cfg.Concurrency < 0 {
		return cfg, fmt.Errorf("concurrency must be non-negative")
	}
	if cfg.RateLimit < 0 {
		return cfg, fmt.Errorf("rate limit must be non-negative")
	}
	if cfg.Timeout < 0 {
		return cfg, fmt.Errorf("timeout must be non-negative")
	}

	if cfg.Concurrency == 0 {
		cfg.Concurrency = defaultScanConcurrency
	}
	if cfg.Concurrency > maxScanConcurrency {
		return cfg, fmt.Errorf("concurrency exceeds hard limit: got %d, max %d", cfg.Concurrency, maxScanConcurrency)
	}
	if cfg.RateLimit == 0 {
		cfg.RateLimit = defaultScanRateLimit
	}
	if cfg.RateLimit > maxScanRateLimit {
		return cfg, fmt.Errorf("rate limit exceeds hard limit: got %d, max %d", cfg.RateLimit, maxScanRateLimit)
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = defaultScanTimeout
	}
	if cfg.Timeout > maxScanTimeout {
		return cfg, fmt.Errorf("timeout exceeds hard limit: got %d, max %d", cfg.Timeout, maxScanTimeout)
	}
	return cfg, nil
}

func halfConcurrency(concurrency int) int {
	if concurrency <= 1 {
		return 1
	}
	return concurrency / 2
}

func nucleiConcurrency(concurrency int) nuclei.Concurrency {
	half := halfConcurrency(concurrency)
	return nuclei.Concurrency{
		TemplateConcurrency:           concurrency,
		HostConcurrency:               concurrency,
		HeadlessHostConcurrency:       half,
		HeadlessTemplateConcurrency:   half,
		JavascriptTemplateConcurrency: half,
		TemplatePayloadConcurrency:    concurrency,
		ProbeConcurrency:              concurrency,
	}
}

func nucleiNetworkConfig(cfg ScanConfig) nuclei.NetworkConfig {
	return nuclei.NetworkConfig{
		MaxHostError: defaultMaxHostError,
		Retries:      defaultScanRetries,
		Timeout:      cfg.Timeout,
	}
}

func nucleiRateLimitConfig(cfg ScanConfig) (int, time.Duration) {
	return cfg.RateLimit, time.Second
}

func disabledInteractshOptions() nuclei.InteractshOpts {
	return nuclei.InteractshOpts{
		CacheSize:           5000,
		Eviction:            60 * time.Second,
		CooldownPeriod:      5 * time.Second,
		PollDuration:        5 * time.Second,
		DisableHttpFallback: true,
		NoInteractsh:        true,
	}
}

func buildNucleiEngineOptions(ctx context.Context, cfg ScanConfig, templatePaths []string) []nuclei.NucleiSDKOptions {
	if ctx == nil {
		ctx = context.Background()
	}
	rateLimit, rateLimitDuration := nucleiRateLimitConfig(cfg)
	return []nuclei.NucleiSDKOptions{
		nuclei.DisableUpdateCheck(),
		nuclei.WithInteractshOptions(disabledInteractshOptions()),
		nuclei.WithTemplatesOrWorkflows(nuclei.TemplateSources{Templates: templatePaths}),
		nuclei.WithConcurrency(nucleiConcurrency(cfg.Concurrency)),
		nuclei.WithGlobalRateLimitCtx(ctx, rateLimit, rateLimitDuration),
		nuclei.WithNetworkConfig(nucleiNetworkConfig(cfg)),
		nuclei.EnableStatsWithOpts(nuclei.StatsOptions{MetricServerPort: 0}),
	}
}

func recordNucleiExecutionError(runID string, result *ScanResult, err error) {
	if result == nil || err == nil {
		return
	}

	result.Aborted = true
	if errors.Is(err, context.Canceled) {
		logger.Info("nuclei scan cancelled", "runID", runID, "error", err)
		return
	}

	result.Errors++
	logger.Error("nuclei scan execution failed", "runID", runID, "error", err)
}

func retainFindingDetail(findings []FindingEvent, finding FindingEvent) []FindingEvent {
	if len(findings) >= maxNucleiResultDetails {
		return findings
	}
	return append(findings, finding)
}

func findingEventFromNucleiResult(runID, taskID string, event *output.ResultEvent) FindingEvent {
	finding := FindingEvent{
		RunID:        runID,
		TaskID:       taskID,
		TemplateID:   event.TemplateID,
		TemplateName: event.Info.Name,
		Severity:     event.Info.SeverityHolder.Severity.String(),
		Host:         event.Host,
		Matched:      event.Matched,
		Timestamp:    time.Now().UnixMilli(),
	}

	if len(event.ExtractedResults) > 0 {
		finding.ExtractedResults = event.ExtractedResults
	}

	return finding
}

// Scanner nuclei scanner.
type Scanner struct {
	ctx     context.Context
	mu      sync.Mutex
	cancels map[string]context.CancelFunc
}

// NewScanner creates a scanner instance.
func NewScanner() *Scanner {
	return &Scanner{
		cancels: make(map[string]context.CancelFunc),
	}
}

// SetContext sets the context.
func (s *Scanner) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// Start starts a scan task.
func (s *Scanner) Start(ctx context.Context, cfg ScanConfig, cb Callbacks) (string, error) {
	normalizedCfg, err := normalizeScanConfig(cfg)
	if err != nil {
		return "", err
	}
	cfg = normalizedCfg

	runID := fmt.Sprintf("nuclei-run-%d", time.Now().UnixNano())

	baseCtx := ctx
	if baseCtx == nil {
		baseCtx = context.Background()
	}
	scanCtx, cancel := context.WithCancel(baseCtx)

	s.mu.Lock()
	s.cancels[runID] = cancel
	s.mu.Unlock()

	go func() {
		defer func() {
			s.mu.Lock()
			delete(s.cancels, runID)
			s.mu.Unlock()
		}()

		s.runScan(scanCtx, runID, cfg, cb)
	}()

	return runID, nil
}

// runScan executes the actual scan.
func (s *Scanner) runScan(ctx context.Context, runID string, cfg ScanConfig, cb Callbacks) {
	started := time.Now().UnixMilli()
	result := ScanResult{
		RunID:     runID,
		TaskID:    cfg.TaskID,
		StartedAt: started,
		Total:     len(cfg.Targets),
	}

	defer func() {
		if r := recover(); r != nil {
			logger.Error("nuclei scan panic recovered", "runID", runID, "error", r)
			result.Aborted = true
		}
		result.FinishedAt = time.Now().UnixMilli()

		// Store result
		s.storeResult(runID, result)

		if cb.OnFinished != nil {
			cb.OnFinished(result)
		}
	}()

	if cb.OnStarted != nil {
		cb.OnStarted(runID, len(cfg.Targets))
	}

	entries, cleanupTemplates, err := prepareTemplateEntriesForScan()
	if err != nil {
		logger.Error("failed to prepare templates", "error", err)
		result.Errors = 1
		result.Aborted = true
		return
	}
	defer cleanupTemplates()

	selectedTemplates, err := selectTemplatesForScan(entries, cfg.Templates)
	if err != nil {
		logger.Error("failed to select templates", "error", err)
		result.Errors = 1
		result.Aborted = true
		return
	}

	templatePaths := make([]string, 0, len(selectedTemplates))
	for _, t := range selectedTemplates {
		templatePaths = append(templatePaths, t.AbsPath)
	}

	// Create nuclei engine
	engineOptions := buildNucleiEngineOptions(ctx, cfg, templatePaths)
	ne, err := nuclei.NewNucleiEngineCtx(ctx, engineOptions...)
	if err != nil {
		logger.Error("failed to create nuclei engine", "error", err)
		result.Errors = 1
		result.Aborted = true
		return
	}
	defer ne.Close()

	// Load targets
	ne.LoadTargets(cfg.Targets, false)

	// Set result callback
	findings := make([]FindingEvent, 0, maxNucleiResultDetails)
	totalFindings := 0
	var mu sync.Mutex

	execErr := ne.ExecuteCallbackWithCtx(ctx, func(event *output.ResultEvent) {
		finding := findingEventFromNucleiResult(runID, cfg.TaskID, event)
		mu.Lock()
		totalFindings++
		findings = retainFindingDetail(findings, finding)
		mu.Unlock()

		if cb.OnFinding != nil {
			cb.OnFinding(finding)
		}
	})

	mu.Lock()
	result.Findings = totalFindings
	result.Results = findings
	mu.Unlock()

	if execErr != nil {
		recordNucleiExecutionError(runID, &result, execErr)
		return
	}

	// Check if cancelled
	select {
	case <-ctx.Done():
		result.Aborted = true
	default:
	}
}

// storeResult stores the scan result.
func (s *Scanner) storeResult(runID string, result ScanResult) {
	data, err := json.Marshal(result)
	if err != nil {
		logger.Warn("failed to marshal nuclei result", "runID", runID, "error", err)
		return
	}

	// Store result metadata
	metaKey := fmt.Sprintf("nuclei:run:%s:meta", runID)
	if err := storage.Put([]byte(metaKey), data); err != nil {
		logger.Warn("failed to store nuclei result", "runID", runID, "error", err)
	}

	// Store task index
	if result.TaskID != "" {
		ts := time.Now().UnixMilli()
		idxKey := fmt.Sprintf("nuclei:task:%s:runs:%d", result.TaskID, ts)
		if err := storage.Put([]byte(idxKey), []byte(runID)); err != nil {
			logger.Warn("failed to store nuclei run index", "runID", runID, "error", err)
		}
	}

	// Global timestamp index
	ts := time.Now().UnixMilli()
	globalIdxKey := fmt.Sprintf("nuclei:runs:ts:%013d:%s", ts, runID)
	if err := storage.Put([]byte(globalIdxKey), []byte(runID)); err != nil {
		logger.Warn("failed to store global nuclei run index", "runID", runID, "error", err)
	}
}

// Cancel cancels a running scan.
func (s *Scanner) Cancel(runID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	cancel, ok := s.cancels[runID]
	if !ok {
		return fmt.Errorf("run not found or already finished: %s", runID)
	}

	cancel()
	delete(s.cancels, runID)
	return nil
}

// GetResult retrieves scan result.
func (s *Scanner) GetResult(runID string) (*ScanResult, error) {
	metaKey := fmt.Sprintf("nuclei:run:%s:meta", runID)
	data, err := storage.Get([]byte(metaKey))
	if err != nil {
		return nil, err
	}

	var result ScanResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// ListRecentRuns lists recent scan runs.
func (s *Scanner) ListRecentRuns(offset, limit int) ([]ScanResult, error) {
	prefix := "nuclei:runs:ts:"
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 || limit > maxRecentRunsLimit {
		limit = maxRecentRunsLimit
	}
	keys, err := storage.ListKeysByPrefixReverse([]byte(prefix), offset, limit)
	if err != nil {
		return nil, err
	}

	if len(keys) == 0 {
		return []ScanResult{}, nil
	}

	results := make([]ScanResult, 0, limit)
	for _, key := range keys {
		keyStr := string(key)
		runID := keyStr
		if idx := strings.LastIndex(keyStr, ":"); idx >= 0 {
			runID = keyStr[idx+1:]
		}
		if runID == "" {
			continue
		}

		result, err := s.GetResult(runID)
		if err != nil {
			continue
		}

		results = append(results, *result)
	}

	return results, nil
}
