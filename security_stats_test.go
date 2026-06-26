package main

import (
	"testing"

	"lack-client/pkg/cloudscan"
	"lack-client/pkg/mcpserver"
	"lack-client/pkg/nucleiscan"
	"lack-client/pkg/storage"
)

func TestAggregateSecurityStatsIncludesMCPNucleiAndCloudScan(t *testing.T) {
	setupReportTestStorage(t)

	mustPutReportJSON(t, "mcp:scan:mcp-1:data", mcpserver.ScanSession{
		ID:           "mcp-1",
		Status:       "finished",
		TotalMatches: 3,
		Critical:     1,
		High:         1,
		Medium:       1,
	})
	if err := storage.Put([]byte("mcp:scans:index:0000000001000:mcp-1"), []byte("mcp-1")); err != nil {
		t.Fatalf("put mcp index: %v", err)
	}

	mustPutReportJSON(t, "nuclei:run:nuclei-1:meta", nucleiscan.ScanResult{
		RunID:    "nuclei-1",
		Findings: 3,
		Results: []nucleiscan.FindingEvent{
			{Severity: "critical"},
			{Severity: "high"},
		},
	})
	if err := storage.Put([]byte("nuclei:runs:ts:0000000001001:nuclei-1"), []byte("nuclei-1")); err != nil {
		t.Fatalf("put nuclei index: %v", err)
	}

	mustPutReportJSON(t, "cloudscan:run:cloud-1:meta", cloudscan.ScanResult{
		ID: "cloud-1",
		SeverityCounts: cloudscan.SeverityCounts{
			High: 1,
			Low:  2,
		},
		Metrics: cloudscan.ScanMetrics{TotalFindings: 3},
	})
	if err := storage.Put([]byte("cloudscan:runs:ts:0000000001002:cloud-1"), []byte("cloud-1")); err != nil {
		t.Fatalf("put cloud index: %v", err)
	}

	stats := aggregateSecurityStats()
	if stats.MCP.Status != "danger" || stats.MCP.Findings != 3 || stats.MCP.Critical != 1 {
		t.Fatalf("MCP stats = %+v, want danger findings=3 critical=1", stats.MCP)
	}
	if stats.Infra.Status != "danger" || stats.Infra.Vulnerabilities != 3 || stats.Infra.Critical != 1 {
		t.Fatalf("Infra stats = %+v, want danger vulns=3 critical=1", stats.Infra)
	}
	if stats.Cloud.Status != "danger" || stats.Cloud.Vulnerabilities != 3 || stats.Cloud.RiskLevel != "High" {
		t.Fatalf("Cloud stats = %+v, want danger vulns=3 risk=High", stats.Cloud)
	}
}

func TestAICloudSecurityServiceRejectsUnsupportedSourceType(t *testing.T) {
	svc := NewAICloudSecurityService()
	_, err := svc.Scan(cloudscan.ScanRequest{SourceType: cloudscan.SourceType("unknown")})
	if err == nil {
		t.Fatal("Scan accepted unsupported source type")
	}
}
