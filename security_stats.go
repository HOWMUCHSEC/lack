package main

import (
	"encoding/json"
	"fmt"
	"lack-client/pkg/cloudscan"
	"lack-client/pkg/mcpserver"
	"lack-client/pkg/nucleiscan"
	"lack-client/pkg/storage"
	"strconv"
	"strings"
)

type securitySeverityCounts struct {
	Critical int
	High     int
	Medium   int
	Low      int
	Unknown  int
}

func aggregateSecurityStats() ReportSecurityStats {
	stats := ReportSecurityStats{
		MCP:   SecurityItem{Status: "secure", RiskLevel: "Low"},
		Infra: SecurityItem{Status: "secure", RiskLevel: "Low"},
		Cloud: SecurityItem{Status: "secure", RiskLevel: "Low"},
	}

	aggregateMCPSecurityStats(&stats.MCP)
	aggregateNucleiSecurityStats(&stats.Infra)
	aggregateCloudSecurityStats(&stats.Cloud)

	finalizeSecurityItem(&stats.MCP)
	finalizeSecurityItem(&stats.Infra)
	finalizeSecurityItem(&stats.Cloud)
	return stats
}

func aggregateMCPSecurityStats(item *SecurityItem) {
	items, err := storage.ListByPrefix([]byte("mcp:scans:index:"), 0, maxListLimit)
	if err != nil {
		return
	}

	counts := securitySeverityCounts{}
	for _, idx := range items {
		id := securityIndexValue(idx.Key, idx.Value, "mcp:scans:index:")
		if id == "" {
			continue
		}

		data, err := storage.Get([]byte(fmt.Sprintf("mcp:scan:%s:data", id)))
		if err != nil || len(data) == 0 {
			continue
		}

		var session mcpserver.ScanSession
		if json.Unmarshal(data, &session) != nil {
			continue
		}

		sessionCounts := securitySeverityCounts{
			Critical: session.Critical,
			High:     session.High,
			Medium:   session.Medium,
			Low:      session.Low,
		}
		if session.TotalMatches > sessionCounts.total() {
			sessionCounts.Unknown += session.TotalMatches - sessionCounts.total()
		}
		counts.addCounts(sessionCounts)
	}

	applySecurityCounts(item, counts)
	item.Findings = counts.total()
	item.Threats = counts.Critical + counts.High
}

func aggregateNucleiSecurityStats(item *SecurityItem) {
	items, err := storage.ListByPrefix([]byte("nuclei:runs:ts:"), 0, maxListLimit)
	if err != nil {
		return
	}

	counts := securitySeverityCounts{}
	for _, idx := range items {
		runID := securityIndexValue(idx.Key, idx.Value, "nuclei:runs:ts:")
		if runID == "" {
			continue
		}

		data, err := storage.Get([]byte(fmt.Sprintf("nuclei:run:%s:meta", runID)))
		if err != nil || len(data) == 0 {
			continue
		}

		var result nucleiscan.ScanResult
		if json.Unmarshal(data, &result) != nil {
			continue
		}

		detailCounts := securitySeverityCounts{}
		for _, finding := range result.Results {
			detailCounts.add(finding.Severity)
		}
		if result.Findings > detailCounts.total() {
			detailCounts.Unknown += result.Findings - detailCounts.total()
		}
		counts.addCounts(detailCounts)
	}

	applySecurityCounts(item, counts)
	item.Findings = counts.total()
	item.Vulnerabilities = counts.total()
	item.Threats = counts.Critical + counts.High
}

func aggregateCloudSecurityStats(item *SecurityItem) {
	items, err := storage.ListByPrefix([]byte("cloudscan:runs:ts:"), 0, maxListLimit)
	if err != nil {
		return
	}

	counts := securitySeverityCounts{}
	for _, idx := range items {
		runID := securityIndexValue(idx.Key, idx.Value, "cloudscan:runs:ts:")
		if runID == "" {
			continue
		}

		data, err := storage.Get([]byte(fmt.Sprintf("cloudscan:run:%s:meta", runID)))
		if err != nil || len(data) == 0 {
			continue
		}

		var result cloudscan.ScanResult
		if json.Unmarshal(data, &result) != nil {
			continue
		}

		runCounts := securitySeverityCounts{
			Critical: result.SeverityCounts.Critical,
			High:     result.SeverityCounts.High,
			Medium:   result.SeverityCounts.Medium,
			Low:      result.SeverityCounts.Low,
			Unknown:  result.SeverityCounts.Unknown,
		}
		if result.Metrics.TotalFindings > runCounts.total() {
			runCounts.Unknown += result.Metrics.TotalFindings - runCounts.total()
		}
		counts.addCounts(runCounts)
	}

	applySecurityCounts(item, counts)
	item.Findings = counts.total()
	item.Vulnerabilities = counts.total()
	item.Threats = counts.Critical + counts.High
}

func applySecurityCounts(item *SecurityItem, counts securitySeverityCounts) {
	item.Critical = counts.Critical
	item.Status = securityStatus(counts)
	item.RiskLevel = securityRiskLevel(counts)
}

func finalizeSecurityItem(item *SecurityItem) {
	if item.Status == "" {
		item.Status = "secure"
	}
	if item.RiskLevel == "" {
		item.RiskLevel = "Low"
	}
}

func securityStatus(counts securitySeverityCounts) string {
	switch {
	case counts.Critical > 0 || counts.High > 0:
		return "danger"
	case counts.Medium > 0 || counts.Low > 0 || counts.Unknown > 0:
		return "warning"
	default:
		return "secure"
	}
}

func securityRiskLevel(counts securitySeverityCounts) string {
	switch {
	case counts.Critical > 0:
		return "Critical"
	case counts.High > 0:
		return "High"
	case counts.Medium > 0:
		return "Medium"
	default:
		return "Low"
	}
}

func (c *securitySeverityCounts) add(severity string) {
	switch strings.ToLower(strings.TrimSpace(severity)) {
	case "critical":
		c.Critical++
	case "high":
		c.High++
	case "medium":
		c.Medium++
	case "low", "info", "informational":
		c.Low++
	default:
		c.Unknown++
	}
}

func (c *securitySeverityCounts) addCounts(other securitySeverityCounts) {
	c.Critical += other.Critical
	c.High += other.High
	c.Medium += other.Medium
	c.Low += other.Low
	c.Unknown += other.Unknown
}

func (c securitySeverityCounts) total() int {
	return c.Critical + c.High + c.Medium + c.Low + c.Unknown
}

func securityIndexValue(key, value []byte, prefix string) string {
	if id := strings.TrimSpace(string(value)); id != "" {
		return id
	}

	suffix := strings.TrimPrefix(string(key), prefix)
	parts := strings.Split(suffix, ":")
	if len(parts) == 0 {
		return ""
	}
	last := strings.TrimSpace(parts[len(parts)-1])
	if _, err := strconv.ParseInt(last, 10, 64); err == nil {
		return ""
	}
	return last
}
