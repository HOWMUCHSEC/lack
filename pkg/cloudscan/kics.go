package cloudscan

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Checkmarx/kics/v2/pkg/printer"
	"github.com/Checkmarx/kics/v2/pkg/progress"
	kicsscan "github.com/Checkmarx/kics/v2/pkg/scan"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

const (
	engineName           = "KICS"
	engineRepository     = "https://github.com/Checkmarx/kics"
	installHint          = "KICS is embedded as a Go package; no external scanner binary is required."
	contentFileName      = "cloud-posture.yaml"
	maxContentBytes      = 5 << 20
	maxFileSizeMB        = maxContentBytes / (1 << 20)
	maxFindingsShown     = 500
	kicsScanTimeout      = 10 * time.Minute
	maxKICSReportBytes   = 25 << 20
	maxKICSReportSizeMsg = "KICS report is too large"
)

var kicsOutputMu sync.Mutex

// Scanner runs AI cloud posture scans through the embedded KICS Go package.
type Scanner struct {
	mu         sync.Mutex
	cond       *sync.Cond
	queriesDir string
	activeRuns int
	closing    bool
}

// NewScanner creates a cloud posture scanner.
func NewScanner() *Scanner {
	return &Scanner{}
}

// Status reports whether the embedded KICS engine and query bundle are usable.
func (s *Scanner) Status() EngineStatus {
	status := EngineStatus{
		Available:   true,
		Engine:      engineName,
		Repository:  engineRepository,
		Path:        "embedded:pkg/cloudscan/kics-queries",
		InstallHint: installHint,
	}
	if !embeddedKICSQueriesAvailable() {
		status.Available = false
		status.Error = "embedded KICS queries are missing"
	}
	return status
}

// ScanContent scans pasted IaC/YAML/JSON/Terraform content with embedded KICS queries.
func (s *Scanner) ScanContent(ctx context.Context, target, content string) (*ScanResult, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, fmt.Errorf("content is required")
	}
	if len(content) > maxContentBytes {
		return nil, fmt.Errorf("content is too large: %d bytes exceeds %d bytes", len(content), maxContentBytes)
	}

	tmpDir, err := os.MkdirTemp("", "lack-cloudscan-content-*")
	if err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	fileName := inferContentFileName(target, content)
	if err := os.WriteFile(filepath.Join(tmpDir, fileName), []byte(content), 0600); err != nil {
		return nil, fmt.Errorf("write temp content: %w", err)
	}

	summary, err := s.runKICS(ctx, tmpDir)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(target) == "" {
		target = "inline IaC content"
	}
	return normalizeKICSSummary(summary, SourceTypeContent, target), nil
}

// ScanRepository scans an HTTP(S) Git repository URL with embedded KICS.
func (s *Scanner) ScanRepository(ctx context.Context, target string) (*ScanResult, error) {
	target = strings.TrimSpace(target)
	if target == "" {
		return nil, fmt.Errorf("repository URL is required")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	scanCtx, cancel := context.WithTimeout(ctx, repositoryScanTimeout)
	defer cancel()
	displayTarget := sanitizeRepositoryDisplayTarget(target)

	scanTarget, cleanup, err := prepareRepositoryTarget(scanCtx, target)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	summary, err := s.runKICS(scanCtx, scanTarget)
	if err != nil {
		return nil, err
	}
	return normalizeKICSSummary(summary, SourceTypeRepository, displayTarget), nil
}

// ScanLocalRepository scans an explicitly selected local repository directory.
func (s *Scanner) ScanLocalRepository(ctx context.Context, target string) (*ScanResult, error) {
	target = strings.TrimSpace(target)
	if target == "" {
		return nil, fmt.Errorf("local repository path is required")
	}

	scanTarget, cleanup, err := prepareLocalRepositoryTarget(target)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	summary, err := s.runKICS(ctx, scanTarget)
	if err != nil {
		return nil, err
	}
	return normalizeKICSSummary(summary, SourceTypeLocalRepository, scanTarget), nil
}

func (s *Scanner) runKICS(ctx context.Context, target string) (kicsSummary, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if err := s.beginRun(); err != nil {
		return kicsSummary{}, err
	}
	defer s.finishRun()
	scanCtx, cancel := context.WithTimeout(ctx, kicsScanTimeout)
	defer cancel()

	queriesDir, err := s.ensureQueriesDir()
	if err != nil {
		return kicsSummary{}, err
	}

	outputDir, err := os.MkdirTemp("", "lack-kics-report-*")
	if err != nil {
		return kicsSummary{}, fmt.Errorf("create KICS report dir: %w", err)
	}
	defer os.RemoveAll(outputDir)

	scanID := uuid.NewString()
	params := &kicsscan.Parameters{
		Path:                     []string{target},
		QueriesPath:              []string{queriesDir},
		Platform:                 []string{""},
		ExcludePlatform:          []string{""},
		CloudProvider:            []string{""},
		ChangedDefaultQueryPath:  true,
		OutputPath:               outputDir,
		OutputName:               "report",
		ReportFormats:            []string{"json"},
		PreviewLines:             3,
		QueryExecTimeout:         60,
		MaxFileSizeFlag:          maxFileSizeMB,
		DisableFullDesc:          true,
		ScanID:                   scanID,
		ParallelScanFlag:         1,
		OpenAPIResolveReferences: true,
	}

	if err := withQuietKICSOutput(func() error {
		client, err := kicsscan.NewClient(params, &progress.PbBuilder{}, printer.NewPrinter(true))
		if err != nil {
			return fmt.Errorf("initialize KICS scanner: %w", err)
		}
		if err := client.PerformScan(scanCtx); err != nil {
			return fmt.Errorf("KICS scan failed: %w", err)
		}
		return nil
	}); err != nil {
		return kicsSummary{}, err
	}

	reportPath := filepath.Join(outputDir, "report.json")
	data, err := readLimitedFile(reportPath, maxKICSReportBytes)
	if err != nil {
		return kicsSummary{}, fmt.Errorf("read KICS report: %w", err)
	}

	var summary kicsSummary
	if err := json.Unmarshal(data, &summary); err != nil {
		return kicsSummary{}, fmt.Errorf("parse KICS report: %w", err)
	}
	return summary, nil
}

func withQuietKICSOutput(fn func() error) error {
	kicsOutputMu.Lock()
	defer kicsOutputMu.Unlock()

	previousLevel := zerolog.GlobalLevel()
	zerolog.SetGlobalLevel(zerolog.Disabled)
	defer zerolog.SetGlobalLevel(previousLevel)

	oldStdout := os.Stdout
	oldStderr := os.Stderr
	devNull, err := os.OpenFile(os.DevNull, os.O_WRONLY, 0)
	if err == nil {
		os.Stdout = devNull
		os.Stderr = devNull
		defer func() {
			os.Stdout = oldStdout
			os.Stderr = oldStderr
			_ = devNull.Close()
		}()
	}

	return fn()
}

func (s *Scanner) ensureQueriesDir() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.queriesDir != "" {
		if info, err := os.Stat(s.queriesDir); err == nil && info.IsDir() {
			return s.queriesDir, nil
		}
		s.queriesDir = ""
	}

	tmpDir, err := os.MkdirTemp("", "lack-kics-queries-*")
	if err != nil {
		return "", fmt.Errorf("create KICS queries dir: %w", err)
	}

	if err := extractEmbeddedKICSQueries(tmpDir); err != nil {
		os.RemoveAll(tmpDir)
		return "", err
	}

	s.queriesDir = tmpDir
	return s.queriesDir, nil
}

func (s *Scanner) initCondLocked() {
	if s.cond == nil {
		s.cond = sync.NewCond(&s.mu)
	}
}

func (s *Scanner) beginRun() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closing {
		return fmt.Errorf("cloud scanner is closing")
	}
	s.initCondLocked()
	s.activeRuns++
	return nil
}

func (s *Scanner) finishRun() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.activeRuns > 0 {
		s.activeRuns--
	}
	if s.activeRuns == 0 && s.cond != nil {
		s.cond.Broadcast()
	}
}

// Close removes the extracted KICS query cache from disk.
func (s *Scanner) Close() error {
	s.mu.Lock()
	s.initCondLocked()
	s.closing = true
	for s.activeRuns > 0 {
		s.cond.Wait()
	}

	if s.queriesDir == "" {
		s.closing = false
		s.mu.Unlock()
		return nil
	}

	dir := s.queriesDir
	s.queriesDir = ""
	s.closing = false
	s.mu.Unlock()

	return os.RemoveAll(dir)
}

func embeddedKICSQueriesAvailable() bool {
	found := false
	_ = fs.WalkDir(kicsQueriesFS, "kics-queries", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if filepath.Base(path) == "query.rego" {
			found = true
			return fs.SkipAll
		}
		return nil
	})
	return found
}

func extractEmbeddedKICSQueries(dest string) error {
	return fs.WalkDir(kicsQueriesFS, "kics-queries", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel("kics-queries", path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		targetPath := filepath.Join(dest, rel)
		if d.IsDir() {
			return os.MkdirAll(targetPath, 0755)
		}

		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return err
		}
		in, err := kicsQueriesFS.Open(path)
		if err != nil {
			return err
		}

		out, err := os.OpenFile(targetPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
		if err != nil {
			_ = in.Close()
			return err
		}
		if _, err := io.Copy(out, in); err != nil {
			_ = in.Close()
			_ = out.Close()
			return err
		}
		if err := in.Close(); err != nil {
			_ = out.Close()
			return err
		}
		return out.Close()
	})
}

func inferContentFileName(target, content string) string {
	if ext := strings.ToLower(filepath.Ext(strings.TrimSpace(target))); ext != "" {
		switch ext {
		case ".tf", ".json", ".yaml", ".yml", ".dockerfile":
			return "cloud-posture" + ext
		}
	}

	trimmed := strings.TrimSpace(content)
	lower := strings.ToLower(trimmed)
	if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[") {
		return "cloud-posture.json"
	}
	if strings.Contains(lower, "resource \"") || strings.Contains(lower, "provider \"") || strings.Contains(lower, "terraform {") || strings.Contains(lower, "variable \"") {
		return "main.tf"
	}
	if strings.Contains(lower, "from ") && strings.Contains(lower, "run ") {
		return "Dockerfile"
	}
	return contentFileName
}

func normalizeKICSSummary(summary kicsSummary, sourceType SourceType, target string) *ScanResult {
	result := &ScanResult{
		ID:         uuid.NewString(),
		Target:     target,
		SourceType: sourceType,
		Engine:     engineName,
		ScannedAt:  time.Now().UnixMilli(),
		Findings:   make([]Finding, 0),
	}

	fileSet := make(map[string]struct{})
	for _, path := range summary.ScannedPaths {
		if strings.TrimSpace(path) != "" {
			fileSet[path] = struct{}{}
		}
	}

	for _, query := range summary.Queries {
		for _, file := range query.Files {
			finding := Finding{
				ID:          stableFindingID(query, file),
				Type:        kicsFindingType(query),
				Severity:    normalizeSeverity(query.Severity),
				Title:       firstNonEmpty(query.QueryName, "Misconfiguration detected"),
				Description: query.Description,
				Message:     buildKICSMessage(query, file),
				Resource:    firstNonEmpty(file.ResourceName, file.SearchKey),
				Provider:    query.CloudProvider,
				Service:     firstNonEmpty(file.ResourceType, query.Platform),
				FilePath:    file.FileName,
				StartLine:   firstPositive(file.Line, file.SearchLine),
				EndLine:     firstPositive(file.Line, file.SearchLine),
				Resolution:  file.Remediation,
				PrimaryURL:  firstNonEmpty(query.QueryURL, kicsDocsURL(query)),
			}
			if query.CWE != "" {
				finding.References = append(finding.References, "CWE-"+query.CWE)
			}
			if query.RiskScore != "" {
				finding.References = append(finding.References, "Risk score: "+query.RiskScore)
			}
			if finding.FilePath != "" {
				fileSet[finding.FilePath] = struct{}{}
			}
			incrementSeverity(&result.SeverityCounts, finding.Severity)
			switch finding.Type {
			case "secret":
				result.Metrics.Secrets++
			default:
				result.Metrics.Misconfigs++
			}
			if isIAMFinding(finding) {
				result.Metrics.IAMRisks++
			}
			if isPublicAssetFinding(finding) {
				result.Metrics.PublicAssets++
			}
			result.Metrics.TotalFindings++
			if len(result.Findings) < maxFindingsShown {
				result.Findings = append(result.Findings, finding)
			}
		}
	}

	sort.SliceStable(result.Findings, func(i, j int) bool {
		si, sj := severityWeight(result.Findings[i].Severity), severityWeight(result.Findings[j].Severity)
		if si != sj {
			return si > sj
		}
		return result.Findings[i].Title < result.Findings[j].Title
	})

	result.Metrics.FilesScanned = firstPositive(summary.FilesScanned, len(fileSet))
	result.Metrics.FailedChecks = summary.TotalCounter
	result.Metrics.PassedChecks = maxInt(summary.TotalQueries-summary.TotalCounter-summary.FailedQueries, 0)
	result.Metrics.ExceptionChecks = summary.FailedQueries

	result.Score = scoreFromSeverity(result.SeverityCounts)
	result.Metrics.Compliance = complianceFromChecks(result.Metrics, result.Score)
	result.Summary = buildSummary(result)
	return result
}

func kicsFindingType(query kicsQueryResult) string {
	haystack := strings.ToLower(query.QueryName + " " + query.Category + " " + query.Description)
	if strings.Contains(haystack, "secret") || strings.Contains(haystack, "password") || strings.Contains(haystack, "credential") {
		return "secret"
	}
	return "misconfiguration"
}

func buildKICSMessage(query kicsQueryResult, file kicsVulnerableFile) string {
	parts := []string{}
	if file.SearchKey != "" {
		parts = append(parts, "key: "+file.SearchKey)
	}
	if file.SearchValue != "" {
		parts = append(parts, "value: "+file.SearchValue)
	}
	if file.KeyExpectedValue != "" || file.KeyActualValue != "" {
		parts = append(parts, fmt.Sprintf("expected %q, got %q", file.KeyExpectedValue, file.KeyActualValue))
	}
	if file.IssueType != "" {
		parts = append(parts, "issue: "+file.IssueType)
	}
	if len(parts) > 0 {
		return strings.Join(parts, "; ")
	}
	return query.Description
}

func stableFindingID(query kicsQueryResult, file kicsVulnerableFile) string {
	line := firstPositive(file.Line, file.SearchLine)
	parts := []string{
		"kics",
		strings.TrimSpace(file.SimilarityID),
		strings.TrimSpace(query.QueryID),
		strings.TrimSpace(query.QueryName),
		strings.TrimSpace(file.FileName),
		fmt.Sprint(line),
		strings.TrimSpace(file.ResourceType),
		strings.TrimSpace(file.ResourceName),
		strings.TrimSpace(file.SearchKey),
		strings.TrimSpace(file.IssueType),
	}
	h := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return "kics-" + hex.EncodeToString(h[:12])
}

func readLimitedFile(path string, maxBytes int64) ([]byte, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if info.Size() > maxBytes {
		return nil, fmt.Errorf("%s: %d bytes exceeds %d bytes", maxKICSReportSizeMsg, info.Size(), maxBytes)
	}
	return os.ReadFile(path)
}

func kicsDocsURL(query kicsQueryResult) string {
	if strings.TrimSpace(query.QueryID) == "" || strings.TrimSpace(query.Platform) == "" {
		return ""
	}
	return fmt.Sprintf("https://docs.kics.io/latest/queries/%s-queries/%s", strings.ToLower(query.Platform), query.QueryID)
}

func firstPositive(values ...int) int {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func normalizeSeverity(sev string) string {
	switch strings.ToLower(strings.TrimSpace(sev)) {
	case "critical":
		return "critical"
	case "high":
		return "high"
	case "medium":
		return "medium"
	case "low":
		return "low"
	default:
		return "unknown"
	}
}

func severityWeight(sev string) int {
	switch normalizeSeverity(sev) {
	case "critical":
		return 5
	case "high":
		return 4
	case "medium":
		return 3
	case "low":
		return 2
	default:
		return 1
	}
}

func incrementSeverity(counts *SeverityCounts, sev string) {
	switch normalizeSeverity(sev) {
	case "critical":
		counts.Critical++
	case "high":
		counts.High++
	case "medium":
		counts.Medium++
	case "low":
		counts.Low++
	default:
		counts.Unknown++
	}
}

func scoreFromSeverity(counts SeverityCounts) int {
	score := 100 -
		counts.Critical*25 -
		counts.High*15 -
		counts.Medium*7 -
		counts.Low*2 -
		counts.Unknown
	if score < 0 {
		return 0
	}
	return score
}

func complianceFromChecks(metrics ScanMetrics, fallbackScore int) int {
	totalChecks := metrics.PassedChecks + metrics.FailedChecks + metrics.ExceptionChecks
	if totalChecks == 0 {
		return fallbackScore
	}
	return int(float64(metrics.PassedChecks) / float64(totalChecks) * 100)
}

func isIAMFinding(f Finding) bool {
	haystack := strings.ToLower(strings.Join([]string{
		f.Title, f.Description, f.Message, f.Resource, f.Provider, f.Service, f.FilePath,
	}, " "))
	return strings.Contains(haystack, "iam") ||
		strings.Contains(haystack, "identity") ||
		strings.Contains(haystack, "privilege") ||
		strings.Contains(haystack, "policy") ||
		f.Type == "secret"
}

func isPublicAssetFinding(f Finding) bool {
	haystack := strings.ToLower(strings.Join([]string{
		f.Title, f.Description, f.Message, f.Resource, f.Service,
	}, " "))
	for _, token := range []string{"public", "0.0.0.0/0", "::/0", "world", "internet", "open to all", "open ingress", "unrestricted"} {
		if strings.Contains(haystack, token) {
			return true
		}
	}
	return false
}

func buildSummary(result *ScanResult) string {
	if result.Metrics.TotalFindings == 0 {
		return "No cloud posture findings detected by KICS."
	}
	return fmt.Sprintf("%d findings: %d critical, %d high, %d medium, %d low.",
		result.Metrics.TotalFindings,
		result.SeverityCounts.Critical,
		result.SeverityCounts.High,
		result.SeverityCounts.Medium,
		result.SeverityCounts.Low,
	)
}
