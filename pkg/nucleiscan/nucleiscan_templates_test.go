package nucleiscan

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	nuclei "github.com/projectdiscovery/nuclei/v3/lib"
	"github.com/projectdiscovery/nuclei/v3/pkg/output"
	"gopkg.in/yaml.v3"
)

func mkEntry(id, name, tags, filePath string) templateEntry {
	return templateEntry{
		Info: TemplateInfo{
			ID:       id,
			Name:     name,
			Tags:     tags,
			FilePath: filePath,
		},
		RelPath: filePath,
		AbsPath: "/tmp/" + filePath,
	}
}

func TestSelectTemplatesForScan_DefaultSelectsAIProfile(t *testing.T) {
	t.Setenv(TemplateFilterModeEnv, "")

	entries := []templateEntry{
		mkEntry("example-http-detection", "Example HTTP", "discovery", "example-http-detection.yaml"),
		mkEntry("ollama-llm-panel", "Ollama Panel", "ollama,llm,detect", "http/exposed-panels/ollama-llm-panel.yaml"),
	}

	selected, err := selectTemplatesForScan(entries, nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(selected) != 1 {
		t.Fatalf("expected AI-profile filtering, got %d selected templates", len(selected))
	}
	if selected[0].Info.ID != "ollama-llm-panel" {
		t.Fatalf("expected ollama profile hit, got %s", selected[0].Info.ID)
	}
}

func TestSelectTemplatesForScan_ExplicitSelectors(t *testing.T) {
	entries := []templateEntry{
		mkEntry("gradio-ssrf", "Gradio SSRF", "gradio,ssrf,vuln", "http/vulnerabilities/gradio/gradio-ssrf.yaml"),
		mkEntry("jupyter-notebook-rce", "Jupyter RCE", "jupyter,rce", "http/vulnerabilities/jupyter-notebook-rce.yaml"),
	}

	selected, err := selectTemplatesForScan(entries, []string{
		"jupyter-notebook-rce",
		"http/vulnerabilities/gradio/gradio-ssrf.yaml",
		"gradio-ssrf", // duplicate by id should dedupe
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(selected) != 2 {
		t.Fatalf("expected 2 unique selected templates, got %d", len(selected))
	}
	if selected[0].Info.ID != "jupyter-notebook-rce" {
		t.Fatalf("expected first selected template to be jupyter-notebook-rce, got %s", selected[0].Info.ID)
	}
	if selected[1].Info.ID != "gradio-ssrf" {
		t.Fatalf("expected second selected template to be gradio-ssrf, got %s", selected[1].Info.ID)
	}
}

func TestSelectTemplatesForScan_SelectorNoMatch(t *testing.T) {
	entries := []templateEntry{
		mkEntry("ollama-llm-panel", "Ollama Panel", "ollama,llm,detect", "ai-ml/ollama-llm-panel.yaml"),
	}

	_, err := selectTemplatesForScan(entries, []string{"non-existent-template"})
	if err == nil {
		t.Fatalf("expected error for unmatched selectors, got nil")
	}
}

func TestSelectTemplatesForScan_BlankExplicitSelectorsReturnError(t *testing.T) {
	entries := []templateEntry{
		mkEntry("ollama-llm-panel", "Ollama Panel", "ollama,llm,detect", "ai-ml/ollama-llm-panel.yaml"),
	}

	_, err := selectTemplatesForScan(entries, []string{" ", "\t"})
	if err == nil {
		t.Fatalf("expected blank explicit selectors to return an error")
	}
}

func TestSelectTemplatesForScan_ExplicitSelectorPartialNoMatch(t *testing.T) {
	entries := []templateEntry{
		mkEntry("gradio-ssrf", "Gradio SSRF", "gradio,ssrf,vuln", "http/vulnerabilities/gradio/gradio-ssrf.yaml"),
		mkEntry("jupyter-notebook-rce", "Jupyter RCE", "jupyter,rce", "http/vulnerabilities/jupyter-notebook-rce.yaml"),
	}

	_, err := selectTemplatesForScan(entries, []string{
		"gradio-ssrf",
		"missing-template",
	})
	if err == nil {
		t.Fatalf("expected partial selector mismatch to return an error")
	}
	if !strings.Contains(err.Error(), "missing-template") {
		t.Fatalf("expected missing selector in error, got %v", err)
	}
}

func TestSelectTemplatesForScan_AmbiguousBaseNameReturnsError(t *testing.T) {
	entries := []templateEntry{
		mkEntry("http-shared", "HTTP Shared", "http", "http/exposures/shared.yaml"),
		mkEntry("dns-shared", "DNS Shared", "dns", "dns/exposures/shared.yaml"),
	}

	_, err := selectTemplatesForScan(entries, []string{"shared.yaml"})
	if err == nil {
		t.Fatalf("expected ambiguous basename selector to return an error")
	}
	if !strings.Contains(err.Error(), "ambiguous") {
		t.Fatalf("expected ambiguous selector error, got %v", err)
	}

	selected, err := selectTemplatesForScan(entries, []string{"dns/exposures/shared.yaml"})
	if err != nil {
		t.Fatalf("expected exact relative path selector to work, got %v", err)
	}
	if len(selected) != 1 || selected[0].Info.ID != "dns-shared" {
		t.Fatalf("expected exact relative path to select dns-shared, got %#v", selected)
	}
}

func TestSelectTemplatesForScan_AllModeStillUsesAIAllowlist(t *testing.T) {
	t.Setenv(TemplateFilterModeEnv, TemplateFilterModeAll)

	entries := []templateEntry{
		mkEntry("ollama-llm-panel", "Ollama Panel", "ollama,llm,detect", "http/exposed-panels/ollama-llm-panel.yaml"),
		mkEntry("example-ssl-detection", "Example SSL", "tls,discovery", "example-ssl-detection.yaml"),
	}

	selected, err := selectTemplatesForScan(entries, nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(selected) != 1 {
		t.Fatalf("expected legacy all mode to stay on the AI allowlist, got %d templates", len(selected))
	}
	if selected[0].Info.ID != "ollama-llm-panel" {
		t.Fatalf("expected AI allowlist template, got %s", selected[0].Info.ID)
	}
}

func TestSelectTemplatesForScan_AIModeFallbackToAllWhenNoHit(t *testing.T) {
	t.Setenv(TemplateFilterModeEnv, TemplateFilterModeAI)

	entries := []templateEntry{
		mkEntry("example-http-detection", "Example HTTP", "discovery", "example-http-detection.yaml"),
		mkEntry("example-ssl-detection", "Example SSL", "tls,discovery", "example-ssl-detection.yaml"),
	}

	_, err := selectTemplatesForScan(entries, nil)
	if err == nil {
		t.Fatalf("expected AI profile with no matches to fail closed")
	}
	if !strings.Contains(err.Error(), "selected 0 templates") {
		t.Fatalf("expected fail-closed error to mention selected 0 templates, got %v", err)
	}
}

func TestSelectTemplatesForScan_AIModeUsesAllowlistOnly(t *testing.T) {
	t.Setenv(TemplateFilterModeEnv, TemplateFilterModeAI)
	oldLoadAIAllowlist := loadAIAllowlist
	loadAIAllowlist = func() ([]string, error) {
		return []string{
			"http/exposed-panels/ollama-llm-panel.yaml",
		}, nil
	}
	t.Cleanup(func() {
		loadAIAllowlist = oldLoadAIAllowlist
	})

	entries := []templateEntry{
		mkEntry("ollama-llm-panel", "Ollama Panel", "ollama,llm,detect", "http/exposed-panels/ollama-llm-panel.yaml"),
		mkEntry("dify-panel", "Dify Panel", "dify,detect", "http/exposed-panels/dify-panel.yaml"),
	}

	selected, err := selectTemplatesForScan(entries, nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(selected) != 1 {
		t.Fatalf("expected only allowlisted templates, got %d templates", len(selected))
	}
	if selected[0].Info.ID != "ollama-llm-panel" {
		t.Fatalf("expected allowlisted template, got %s", selected[0].Info.ID)
	}
}

func TestSelectTemplatesForScan_AllowlistMissingEntriesDoesNotAddKeywordMatches(t *testing.T) {
	t.Setenv(TemplateFilterModeEnv, TemplateFilterModeAI)
	oldLoadAIAllowlist := loadAIAllowlist
	loadAIAllowlist = func() ([]string, error) {
		return []string{
			"http/exposed-panels/ollama-llm-panel.yaml",
			"http/missing-template.yaml",
		}, nil
	}
	t.Cleanup(func() {
		loadAIAllowlist = oldLoadAIAllowlist
	})

	entries := []templateEntry{
		mkEntry("ollama-llm-panel", "Ollama Panel", "ollama,llm,detect", "http/exposed-panels/ollama-llm-panel.yaml"),
		mkEntry("langflow-rce", "Langflow Remote Code Execution", "langflow,rce", "http/cves/2025/CVE-2025-3248.yaml"),
	}

	selected, err := selectTemplatesForScan(entries, nil)
	if err != nil {
		t.Fatalf("expected missing allowlist entries to warn and continue, got %v", err)
	}
	if len(selected) != 1 {
		t.Fatalf("expected only available allowlist entries, got %d templates", len(selected))
	}
	if selected[0].Info.ID != "ollama-llm-panel" {
		t.Fatalf("expected available allowlist template, got %s", selected[0].Info.ID)
	}
}

func TestContainsTemplateKeywordRequiresWordBoundary(t *testing.T) {
	if containsTemplateKeyword("WordPress plugin can modify data", "dify") {
		t.Fatal("did not expect dify to match inside modify")
	}
	if !containsTemplateKeyword("Dify panel exposure", "dify") {
		t.Fatal("expected dify to match as a standalone technology name")
	}
	if isAIRelevantTemplate(TemplateInfo{Name: "AWS X-Ray Sample Application", Tags: "aws,x-ray,amazon", FilePath: "http/misconfiguration/aws/aws-xray-application.yaml"}) {
		t.Fatal("AWS X-Ray should not be treated as Anyscale Ray infrastructure")
	}
}

func TestBuiltinAIAllowlistMatchesProfile(t *testing.T) {
	profilePath := filepath.Join("..", "..", TemplatesDir, aiTemplateAllowlistPath)
	profileBytes, err := os.ReadFile(profilePath)
	if err != nil {
		t.Fatalf("failed to read %s: %v", profilePath, err)
	}

	var profile templateAllowlist
	if err := yaml.Unmarshal(profileBytes, &profile); err != nil {
		t.Fatalf("failed to parse %s: %v", profilePath, err)
	}
	if len(profile.Templates) != 212 {
		t.Fatalf("expected profile to contain 212 templates, got %d", len(profile.Templates))
	}
	if len(builtinAITemplateAllowlist) != len(profile.Templates) {
		t.Fatalf("expected builtin allowlist to contain %d templates, got %d", len(profile.Templates), len(builtinAITemplateAllowlist))
	}
	for i, want := range profile.Templates {
		want = filepath.ToSlash(strings.TrimSpace(want))
		if got := builtinAITemplateAllowlist[i]; got != want {
			t.Fatalf("builtin allowlist mismatch at index %d: got %q, want %q", i, got, want)
		}
	}
}

func TestLoadEmbeddedAIAllowlistReadsEmbeddedProfile(t *testing.T) {
	oldEmbeddedTemplates := EmbeddedTemplates
	EmbeddedTemplates = fstest.MapFS{
		filepath.ToSlash(filepath.Join(TemplatesDir, aiTemplateAllowlistPath)): {
			Data: []byte("templates:\n  - http/exposed-panels/ollama-llm-panel.yaml\n  - http/misconfiguration/mlflow-unauth.yaml\n"),
		},
	}
	t.Cleanup(func() {
		EmbeddedTemplates = oldEmbeddedTemplates
	})

	allowlist, err := loadEmbeddedAIAllowlist()
	if err != nil {
		t.Fatalf("expected embedded allowlist to load, got %v", err)
	}
	want := []string{
		"http/exposed-panels/ollama-llm-panel.yaml",
		"http/misconfiguration/mlflow-unauth.yaml",
	}
	if !reflect.DeepEqual(allowlist, want) {
		t.Fatalf("unexpected allowlist: got %#v, want %#v", allowlist, want)
	}
}

func TestLoadEmbeddedAIAllowlistFallsBackToBuiltinWhenProfileMissing(t *testing.T) {
	oldEmbeddedTemplates := EmbeddedTemplates
	EmbeddedTemplates = fstest.MapFS{}
	t.Cleanup(func() {
		EmbeddedTemplates = oldEmbeddedTemplates
	})

	allowlist, err := loadEmbeddedAIAllowlist()
	if err != nil {
		t.Fatalf("expected builtin compatibility allowlist fallback, got %v", err)
	}
	if !reflect.DeepEqual(allowlist, builtinAITemplateAllowlist) {
		t.Fatalf("expected builtin compatibility allowlist fallback")
	}
}

type readErrorFS struct {
	fstest.MapFS
}

func (f readErrorFS) ReadFile(name string) ([]byte, error) {
	if name == "http/broken.yaml" {
		return nil, errors.New("read failed")
	}
	return f.MapFS.ReadFile(name)
}

func TestListTemplateEntriesFromFS_SkipsProfilesDotfilesAndInvalidYAML(t *testing.T) {
	validTemplate := []byte(`id: valid-template
info:
  name: Valid Template
  author: test
  severity: info
`)
	fsys := fstest.MapFS{
		"http/valid.yaml": {
			Data: validTemplate,
		},
		"profiles/ai-llm.yaml": {
			Data: []byte("templates:\n  - http/valid.yaml\n"),
		},
		".hidden.yaml": {
			Data: validTemplate,
		},
		"http/.hidden-template.yaml": {
			Data: validTemplate,
		},
		"notes.yaml": {
			Data: []byte("templates:\n  - http/valid.yaml\n"),
		},
	}

	entries, err := listTemplateEntriesFromFS(fsys, ".", func(relPath string) string {
		return filepath.Join("/templates", filepath.FromSlash(relPath))
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected only the real template to be listed, got %d entries: %#v", len(entries), entries)
	}
	if entries[0].RelPath != "http/valid.yaml" {
		t.Fatalf("expected http/valid.yaml, got %s", entries[0].RelPath)
	}
}

func TestListTemplateEntriesFromFS_ReturnsTemplateReadErrors(t *testing.T) {
	fsys := readErrorFS{MapFS: fstest.MapFS{
		"http/broken.yaml": {
			Data: []byte(`id: broken-template
info:
  name: Broken Template
  severity: info
`),
		},
	}}

	_, err := listTemplateEntriesFromFS(fsys, ".", func(relPath string) string {
		return relPath
	})
	if err == nil {
		t.Fatalf("expected template read error")
	}
	if !strings.Contains(err.Error(), "http/broken.yaml") {
		t.Fatalf("expected read error to mention template path, got %v", err)
	}
}

func TestFindConfiguredTemplatesDir_DoesNotUseDefaultTmpWithoutEnv(t *testing.T) {
	t.Setenv(TemplatesDirEnv, "")
	t.Setenv(ExternalTemplatesOptInEnv, "")
	t.Chdir(t.TempDir())

	templatePath := filepath.Join(DefaultExternalTemplatesDir, "http", "valid.yaml")
	if err := os.MkdirAll(filepath.Dir(templatePath), 0755); err != nil {
		t.Fatalf("failed to create temp template dir: %v", err)
	}
	if err := os.WriteFile(templatePath, []byte(`id: valid-template
info:
  name: Valid Template
  author: test
  severity: info
`), 0644); err != nil {
		t.Fatalf("failed to write temp template: %v", err)
	}

	if got := findConfiguredTemplatesDir(); got != "" {
		t.Fatalf("expected no configured templates dir without env override, got %s", got)
	}
	if got := findDefaultExternalTemplatesDir(); got != "" {
		t.Fatalf("expected fallback tmp templates dir to require opt-in, got %s", got)
	}

	t.Setenv(ExternalTemplatesOptInEnv, "1")
	if got := findDefaultExternalTemplatesDir(); got == "" {
		t.Fatalf("expected fallback tmp templates dir to be discoverable with opt-in")
	}
}

func TestConfiguredTemplatesDirRequiresExternalOptIn(t *testing.T) {
	templateDir := t.TempDir()
	templatePath := filepath.Join(templateDir, "http", "valid.yaml")
	if err := os.MkdirAll(filepath.Dir(templatePath), 0755); err != nil {
		t.Fatalf("failed to create template dir: %v", err)
	}
	if err := os.WriteFile(templatePath, []byte(`id: valid-template
info:
  name: Valid Template
  author: test
  severity: info
`), 0644); err != nil {
		t.Fatalf("failed to write template: %v", err)
	}

	t.Setenv(TemplatesDirEnv, templateDir)
	t.Setenv(ExternalTemplatesOptInEnv, "")
	_, configured, err := configuredTemplatesDir()
	if !configured {
		t.Fatalf("expected configured templates dir to be detected")
	}
	if err == nil {
		t.Fatalf("expected missing external opt-in to return an error")
	}
	if !strings.Contains(err.Error(), ExternalTemplatesOptInEnv) {
		t.Fatalf("expected error to mention %s, got %v", ExternalTemplatesOptInEnv, err)
	}

	t.Setenv(ExternalTemplatesOptInEnv, "1")
	got, configured, err := configuredTemplatesDir()
	if err != nil {
		t.Fatalf("expected configured templates dir with opt-in to work, got %v", err)
	}
	if !configured || got == "" {
		t.Fatalf("expected configured templates dir with opt-in, got configured=%v dir=%q", configured, got)
	}
}

func TestListEmbeddedTemplates_InvalidConfiguredDirReturnsError(t *testing.T) {
	missingDir := filepath.Join(t.TempDir(), "missing")
	t.Setenv(TemplatesDirEnv, missingDir)
	t.Setenv(ExternalTemplatesOptInEnv, "1")

	_, err := ListEmbeddedTemplates()
	if err == nil {
		t.Fatalf("expected invalid configured templates dir to return an error")
	}
	if !strings.Contains(err.Error(), TemplatesDirEnv) {
		t.Fatalf("expected error to mention %s, got %v", TemplatesDirEnv, err)
	}
}

func TestNormalizeScanConfig_DefaultsAndRejectsNegativeValues(t *testing.T) {
	cfg, err := normalizeScanConfig(ScanConfig{Targets: []string{"  https://example.com  ", "\t"}})
	if err != nil {
		t.Fatalf("expected defaults to be applied, got error: %v", err)
	}
	if len(cfg.Targets) != 1 || cfg.Targets[0] != "https://example.com" {
		t.Fatalf("expected targets to be trimmed and blank targets removed, got %#v", cfg.Targets)
	}
	if cfg.Concurrency != defaultScanConcurrency {
		t.Fatalf("expected default concurrency %d, got %d", defaultScanConcurrency, cfg.Concurrency)
	}
	if cfg.RateLimit != defaultScanRateLimit {
		t.Fatalf("expected default rate limit %d, got %d", defaultScanRateLimit, cfg.RateLimit)
	}
	if cfg.Timeout != defaultScanTimeout {
		t.Fatalf("expected default timeout %d, got %d", defaultScanTimeout, cfg.Timeout)
	}

	cases := []struct {
		name string
		cfg  ScanConfig
		want string
	}{
		{
			name: "negative concurrency",
			cfg:  ScanConfig{Targets: []string{"https://example.com"}, Concurrency: -1},
			want: "concurrency",
		},
		{
			name: "negative rate limit",
			cfg:  ScanConfig{Targets: []string{"https://example.com"}, RateLimit: -1},
			want: "rate limit",
		},
		{
			name: "negative timeout",
			cfg:  ScanConfig{Targets: []string{"https://example.com"}, Timeout: -1},
			want: "timeout",
		},
		{
			name: "missing targets",
			cfg:  ScanConfig{},
			want: "no targets",
		},
		{
			name: "blank targets",
			cfg:  ScanConfig{Targets: []string{" ", "\t"}},
			want: "no targets",
		},
		{
			name: "too many targets",
			cfg:  ScanConfig{Targets: strings.Split(strings.Repeat("https://example.com,", maxScanTargets+1), ",")},
			want: "too many targets",
		},
		{
			name: "concurrency over hard limit",
			cfg:  ScanConfig{Targets: []string{"https://example.com"}, Concurrency: maxScanConcurrency + 1},
			want: "concurrency exceeds hard limit",
		},
		{
			name: "rate limit over hard limit",
			cfg:  ScanConfig{Targets: []string{"https://example.com"}, RateLimit: maxScanRateLimit + 1},
			want: "rate limit exceeds hard limit",
		},
		{
			name: "timeout over hard limit",
			cfg:  ScanConfig{Targets: []string{"https://example.com"}, Timeout: maxScanTimeout + 1},
			want: "timeout exceeds hard limit",
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			_, err := normalizeScanConfig(tt.cfg)
			if err == nil {
				t.Fatalf("expected validation error containing %q, got nil", tt.want)
			}
			if !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("expected validation error containing %q, got %v", tt.want, err)
			}
		})
	}
}

func TestRetainFindingDetailCapsStoredResults(t *testing.T) {
	findings := make([]FindingEvent, 0, maxNucleiResultDetails)
	total := 0
	for i := 0; i < maxNucleiResultDetails+3; i++ {
		total++
		findings = retainFindingDetail(findings, FindingEvent{TemplateID: "template"})
	}

	if total != maxNucleiResultDetails+3 {
		t.Fatalf("expected total finding count to remain accurate, got %d", total)
	}
	if len(findings) != maxNucleiResultDetails {
		t.Fatalf("expected stored finding details to be capped at %d, got %d", maxNucleiResultDetails, len(findings))
	}
}

func TestFindingEventFromNucleiResultCarriesRunAndTaskIDs(t *testing.T) {
	finding := findingEventFromNucleiResult("run-1", "task-1", &output.ResultEvent{
		TemplateID:       "template-1",
		Host:             "https://example.test",
		Matched:          "https://example.test/path",
		ExtractedResults: []string{"token"},
	})

	if finding.RunID != "run-1" {
		t.Fatalf("expected runID run-1, got %q", finding.RunID)
	}
	if finding.TaskID != "task-1" {
		t.Fatalf("expected taskID task-1, got %q", finding.TaskID)
	}
	if finding.TemplateID != "template-1" {
		t.Fatalf("expected templateID template-1, got %q", finding.TemplateID)
	}
	if len(finding.ExtractedResults) != 1 || finding.ExtractedResults[0] != "token" {
		t.Fatalf("expected extracted result token, got %#v", finding.ExtractedResults)
	}
}

func TestNucleiConcurrency_NeverProducesZeroHalfConcurrency(t *testing.T) {
	concurrency := nucleiConcurrency(1)

	if concurrency.TemplateConcurrency != 1 {
		t.Fatalf("expected template concurrency 1, got %d", concurrency.TemplateConcurrency)
	}
	if concurrency.HostConcurrency != 1 {
		t.Fatalf("expected host concurrency 1, got %d", concurrency.HostConcurrency)
	}
	if concurrency.HeadlessHostConcurrency != 1 {
		t.Fatalf("expected headless host concurrency 1, got %d", concurrency.HeadlessHostConcurrency)
	}
	if concurrency.HeadlessTemplateConcurrency != 1 {
		t.Fatalf("expected headless template concurrency 1, got %d", concurrency.HeadlessTemplateConcurrency)
	}
	if concurrency.JavascriptTemplateConcurrency != 1 {
		t.Fatalf("expected javascript template concurrency 1, got %d", concurrency.JavascriptTemplateConcurrency)
	}
}

func TestNucleiRateLimitAndNetworkConfigCarryScanConfig(t *testing.T) {
	cfg := ScanConfig{RateLimit: 42, Timeout: 17}

	rateLimit, duration := nucleiRateLimitConfig(cfg)
	if rateLimit != cfg.RateLimit {
		t.Fatalf("expected rate limit %d, got %d", cfg.RateLimit, rateLimit)
	}
	if duration != time.Second {
		t.Fatalf("expected rate limit duration %s, got %s", time.Second, duration)
	}

	networkConfig := nucleiNetworkConfig(cfg)
	if networkConfig.Timeout != cfg.Timeout {
		t.Fatalf("expected timeout %d, got %d", cfg.Timeout, networkConfig.Timeout)
	}
	if networkConfig.Retries != defaultScanRetries {
		t.Fatalf("expected retries %d, got %d", defaultScanRetries, networkConfig.Retries)
	}
	if networkConfig.MaxHostError != defaultMaxHostError {
		t.Fatalf("expected max host error %d, got %d", defaultMaxHostError, networkConfig.MaxHostError)
	}
}

func TestBuildNucleiEngineOptionsDisablesInteractsh(t *testing.T) {
	opts := buildNucleiEngineOptions(context.Background(), ScanConfig{
		Concurrency: 1,
		RateLimit:   1,
		Timeout:     1,
	}, []string{"template.yaml"})

	engine, err := nuclei.NewNucleiEngineCtx(context.Background(), opts...)
	if err != nil {
		t.Fatalf("expected nuclei engine options to initialize, got %v", err)
	}
	t.Cleanup(engine.Close)

	engineValue := reflect.ValueOf(engine).Elem()
	interactshOpts := engineValue.FieldByName("interactshOpts")
	if !interactshOpts.IsValid() || interactshOpts.IsNil() {
		t.Fatal("expected interactsh options to be configured")
	}

	noInteractsh := interactshOpts.Elem().FieldByName("NoInteractsh")
	if !noInteractsh.IsValid() {
		t.Fatal("expected interactsh options to expose NoInteractsh")
	}
	if !noInteractsh.Bool() {
		t.Fatal("expected interactsh to be disabled by default")
	}
}

func TestRecordNucleiExecutionError_MarksAbortedAndCountsNonCancelErrors(t *testing.T) {
	result := ScanResult{}
	recordNucleiExecutionError("run-1", &result, errors.New("execute failed"))

	if !result.Aborted {
		t.Fatalf("expected non-cancel execution error to mark scan aborted")
	}
	if result.Errors != 1 {
		t.Fatalf("expected non-cancel execution error to increment errors, got %d", result.Errors)
	}

	cancelled := ScanResult{}
	recordNucleiExecutionError("run-2", &cancelled, context.Canceled)
	if !cancelled.Aborted {
		t.Fatalf("expected cancelled execution to mark scan aborted")
	}
	if cancelled.Errors != 0 {
		t.Fatalf("expected cancelled execution not to count as scan error, got %d", cancelled.Errors)
	}
}
