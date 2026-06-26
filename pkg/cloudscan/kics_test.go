package cloudscan

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestNormalizeKICSSummaryMapsFindingsAndMetrics(t *testing.T) {
	summary := kicsSummary{
		FilesScanned:  1,
		TotalQueries:  10,
		TotalCounter:  2,
		FailedQueries: 0,
		Queries: []kicsQueryResult{
			{
				QueryName:     "Unrestricted Security Group Ingress",
				QueryID:       "query-high",
				Severity:      "HIGH",
				Platform:      "Terraform",
				CloudProvider: "AWS",
				Description:   "Security group ingress is open to the world.",
				Files: []kicsVulnerableFile{{
					FileName:     "main.tf",
					Line:         6,
					ResourceType: "aws_security_group_rule",
					ResourceName: "ssh",
					SearchValue:  "0.0.0.0/0",
				}},
			},
			{
				QueryName:     "IAM Access Analyzer Not Enabled",
				QueryID:       "query-low",
				Severity:      "LOW",
				Platform:      "Terraform",
				CloudProvider: "AWS",
				Description:   "IAM access analyzer is not enabled.",
				Files: []kicsVulnerableFile{{
					FileName: "main.tf",
					Line:     1,
				}},
			},
		},
	}

	result := normalizeKICSSummary(summary, SourceTypeContent, "inline")

	if result.Engine != engineName {
		t.Fatalf("engine = %q, want %q", result.Engine, engineName)
	}
	if result.Score != 83 {
		t.Fatalf("score = %d, want 83", result.Score)
	}
	if result.Metrics.Compliance != 80 {
		t.Fatalf("compliance = %d, want 80", result.Metrics.Compliance)
	}
	if result.Metrics.PublicAssets != 1 {
		t.Fatalf("public assets = %d, want 1", result.Metrics.PublicAssets)
	}
	if result.Metrics.IAMRisks != 1 {
		t.Fatalf("iam risks = %d, want 1", result.Metrics.IAMRisks)
	}
	if result.SeverityCounts.High != 1 || result.SeverityCounts.Low != 1 {
		t.Fatalf("unexpected severity counts: %+v", result.SeverityCounts)
	}
	if len(result.Findings) != 2 {
		t.Fatalf("findings = %d, want 2", len(result.Findings))
	}
	if result.Findings[0].Severity != "high" {
		t.Fatalf("first finding severity = %q, want high", result.Findings[0].Severity)
	}
}

func TestStatusUsesEmbeddedKICS(t *testing.T) {
	status := NewScanner().Status()
	if !status.Available {
		t.Fatalf("expected embedded KICS to be available: %+v", status)
	}
	if status.Engine != "KICS" {
		t.Fatalf("engine = %q, want KICS", status.Engine)
	}
}

func TestEmbeddedKICSQueriesIncludeLicense(t *testing.T) {
	data, err := kicsQueriesFS.ReadFile("kics-queries/LICENSE")
	if err != nil {
		t.Fatalf("expected embedded KICS license: %v", err)
	}
	if !strings.Contains(string(data), "Apache License") {
		t.Fatalf("embedded KICS license does not look like Apache 2.0")
	}
}

func TestScannerCloseRemovesExtractedKICSQueries(t *testing.T) {
	scanner := NewScanner()
	queriesDir, err := scanner.ensureQueriesDir()
	if err != nil {
		t.Fatalf("ensureQueriesDir() error = %v", err)
	}
	if _, err := os.Stat(queriesDir); err != nil {
		t.Fatalf("expected extracted queries dir to exist: %v", err)
	}

	if err := scanner.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
	if scanner.queriesDir != "" {
		t.Fatalf("queriesDir = %q, want empty after Close", scanner.queriesDir)
	}
	if _, err := os.Stat(queriesDir); !os.IsNotExist(err) {
		t.Fatalf("expected queries dir to be removed, stat error = %v", err)
	}
	if err := scanner.Close(); err != nil {
		t.Fatalf("second Close() error = %v", err)
	}
}

func TestScannerCloseWaitsForActiveRunBeforeRemovingQueries(t *testing.T) {
	scanner := NewScanner()
	queriesDir, err := scanner.ensureQueriesDir()
	if err != nil {
		t.Fatalf("ensureQueriesDir() error = %v", err)
	}
	if err := scanner.beginRun(); err != nil {
		t.Fatalf("beginRun() error = %v", err)
	}

	closeDone := make(chan error, 1)
	go func() {
		closeDone <- scanner.Close()
	}()

	select {
	case err := <-closeDone:
		t.Fatalf("Close() returned before active run finished: %v", err)
	case <-time.After(50 * time.Millisecond):
	}
	if _, err := os.Stat(queriesDir); err != nil {
		t.Fatalf("queries dir should still exist while active run holds it: %v", err)
	}

	scanner.finishRun()
	select {
	case err := <-closeDone:
		if err != nil {
			t.Fatalf("Close() error = %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Close() did not return after active run finished")
	}
	if _, err := os.Stat(queriesDir); !os.IsNotExist(err) {
		t.Fatalf("expected queries dir to be removed after run finished, stat error = %v", err)
	}
}

func TestNormalizeKICSSummaryCapsFindingDetailsButCountsAllFindings(t *testing.T) {
	files := make([]kicsVulnerableFile, 0, maxFindingsShown+3)
	for i := 0; i < maxFindingsShown+3; i++ {
		files = append(files, kicsVulnerableFile{
			FileName:     "main.tf",
			Line:         i + 1,
			ResourceName: "resource",
		})
	}
	summary := kicsSummary{
		TotalQueries: 1,
		TotalCounter: len(files),
		Queries: []kicsQueryResult{{
			QueryName: "Repeated finding",
			QueryID:   "query-repeated",
			Severity:  "LOW",
			Files:     files,
		}},
	}

	result := normalizeKICSSummary(summary, SourceTypeContent, "inline")

	if len(result.Findings) != maxFindingsShown {
		t.Fatalf("stored findings = %d, want %d", len(result.Findings), maxFindingsShown)
	}
	if result.Metrics.TotalFindings != maxFindingsShown+3 {
		t.Fatalf("total findings = %d, want %d", result.Metrics.TotalFindings, maxFindingsShown+3)
	}
	if result.SeverityCounts.Low != maxFindingsShown+3 {
		t.Fatalf("low count = %d, want %d", result.SeverityCounts.Low, maxFindingsShown+3)
	}
	if result.Metrics.Misconfigs != maxFindingsShown+3 {
		t.Fatalf("misconfigs = %d, want %d", result.Metrics.Misconfigs, maxFindingsShown+3)
	}
}

func TestNormalizeKICSSummaryUsesStableUniqueFindingIDs(t *testing.T) {
	summary := kicsSummary{
		Queries: []kicsQueryResult{{
			QueryName: "Same query",
			QueryID:   "duplicate-query-id",
			Severity:  "HIGH",
			Files: []kicsVulnerableFile{
				{FileName: "a.tf", Line: 1, ResourceName: "a"},
				{FileName: "b.tf", Line: 1, ResourceName: "b"},
				{FileName: "a.tf", Line: 1, ResourceName: "a", SimilarityID: "similarity-a"},
			},
		}},
	}

	result := normalizeKICSSummary(summary, SourceTypeContent, "inline")
	seen := map[string]struct{}{}
	for _, finding := range result.Findings {
		if !strings.HasPrefix(finding.ID, "kics-") {
			t.Fatalf("finding ID = %q, want kics- prefix", finding.ID)
		}
		if _, ok := seen[finding.ID]; ok {
			t.Fatalf("duplicate finding ID %q in %+v", finding.ID, result.Findings)
		}
		seen[finding.ID] = struct{}{}
	}
}

func TestReadLimitedFileRejectsOversizedReport(t *testing.T) {
	path := filepath.Join(t.TempDir(), "report.json")
	if err := os.WriteFile(path, []byte("123456"), 0600); err != nil {
		t.Fatalf("write report: %v", err)
	}

	_, err := readLimitedFile(path, 3)
	if err == nil {
		t.Fatal("expected oversized report to be rejected")
	}
	if !strings.Contains(err.Error(), maxKICSReportSizeMsg) {
		t.Fatalf("error = %q", err)
	}
}

func TestScanContentRunsKICSPackage(t *testing.T) {
	content := `resource "aws_security_group_rule" "mysql" {
  type              = "ingress"
  from_port         = 3306
  to_port           = 3306
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.default.id
}
`
	result, err := NewScanner().ScanContent(context.Background(), "main.tf", content)
	if err != nil {
		t.Fatalf("ScanContent() error = %v", err)
	}
	if result.Engine != engineName {
		t.Fatalf("engine = %q, want %q", result.Engine, engineName)
	}
	if result.Metrics.TotalFindings == 0 {
		t.Fatalf("expected KICS to report at least one finding, got metrics: %+v", result.Metrics)
	}
	joined := strings.ToLower(result.Summary)
	if !strings.Contains(joined, "findings") {
		t.Fatalf("summary = %q, want findings count", result.Summary)
	}
}
