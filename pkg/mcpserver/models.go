package mcpserver

import (
	"encoding/json"
	"strings"
)

// LocalServerStatus represents the status of the local MCP server.
type LocalServerStatus struct {
	Running   bool   `json:"running"`             // Whether it is running
	Endpoint  string `json:"endpoint"`            // Server endpoint URL (WebSocket: ws://...)
	AuthToken string `json:"authToken,omitempty"` // Random token required by local clients
	Port      int    `json:"port"`                // Listening port
	StartedAt int64  `json:"startedAt"`           // Start timestamp (ms)
}

// ========== WebSocket Message Types ==========

// ScanMessage generic message structure sent by the scanner.
type ScanMessage struct {
	Version   string          `json:"version"`   // Protocol version
	Code      int             `json:"code"`      // Status code
	Status    string          `json:"status"`    // Status: success/error
	Type      string          `json:"type"`      // Message type: start/result/complete
	ScannerID string          `json:"scannerId"` // Scanner ID
	ScanID    string          `json:"scanId"`    // Scan Task ID
	Timestamp string          `json:"timestamp"` // ISO8601 timestamp
	Data      json.RawMessage `json:"data"`      // Raw message data (decode by type)
	Meta      ScanMeta        `json:"meta"`      // Scan metadata
}

// ScanMeta scan progress metadata.
type ScanMeta struct {
	TotalFiles   int `json:"totalFiles"`   // Total files
	ScannedFiles int `json:"scannedFiles"` // Scanned files
	TotalMatches int `json:"totalMatches"` // Total matches
}

// StartData data field for type="start" message.
type StartData struct {
	Targets    []string `json:"targets"`    // Scan target paths
	TotalFiles int      `json:"totalFiles"` // Total files
}

// ResultData data field for type="result" message (single risk result).
type ResultData struct {
	RuleID      string `json:"ruleId"`      // Rule ID
	RuleName    string `json:"ruleName"`    // Rule name
	FilePath    string `json:"filePath"`    // File path
	Line        int    `json:"line"`        // Line number
	Column      int    `json:"column"`      // Column number
	MatchedText string `json:"matchedText"` // Matched text
	Context     string `json:"context"`     // Context code snippet
	Language    string `json:"language"`    // Language type
	Severity    string `json:"severity"`    // Severity: critical/high/medium/low
	Description string `json:"description"` // Issue description
	Timestamp   string `json:"timestamp"`   // Discovery time
}

// CompleteData data field for type="complete" message.
type CompleteData struct {
	Status       string `json:"status"`       // Completion status: finished/aborted
	TotalFiles   int    `json:"totalFiles"`   // Total files
	ScannedFiles int    `json:"scannedFiles"` // Scanned files
	TotalMatches int    `json:"totalMatches"` // Total matches
}

// ========== Storage Models ==========

// ScanSession scan session, used to store a complete scan process.
type ScanSession struct {
	ID           string       `json:"id"`           // Scan ID (from scanId)
	ScannerID    string       `json:"scannerId"`    // Scanner ID
	Status       string       `json:"status"`       // Status: running/finished/aborted
	Targets      []string     `json:"targets"`      // Scan targets
	TotalFiles   int          `json:"totalFiles"`   // Total files
	ScannedFiles int          `json:"scannedFiles"` // Scanned files
	TotalMatches int          `json:"totalMatches"` // Total matches
	Critical     int          `json:"critical"`     // Critical severity issues
	High         int          `json:"high"`         // High severity issues
	Medium       int          `json:"medium"`       // Medium severity issues
	Low          int          `json:"low"`          // Low severity issues
	StartedAt    int64        `json:"startedAt"`    // Start timestamp (ms)
	CompletedAt  int64        `json:"completedAt"`  // Completion timestamp (ms)
	Results      []ResultData `json:"results"`      // Scan result list
}

// UnmarshalJSON keeps archived sessions written before the critical field compatible.
func (s *ScanSession) UnmarshalJSON(data []byte) error {
	type Alias ScanSession
	var alias Alias
	if err := json.Unmarshal(data, &alias); err != nil {
		return err
	}

	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}
	if _, hasCritical := fields["critical"]; !hasCritical && len(alias.Results) > 0 {
		alias.Critical, alias.High, alias.Medium, alias.Low = countScanResultSeverities(alias.Results)
	}

	*s = ScanSession(alias)
	return nil
}

func countScanResultSeverities(results []ResultData) (critical, high, medium, low int) {
	for _, result := range results {
		switch strings.ToLower(strings.TrimSpace(result.Severity)) {
		case "critical":
			critical++
		case "high":
			high++
		case "medium":
			medium++
		default:
			low++
		}
	}
	return critical, high, medium, low
}

// ========== Legacy Model Compatibility (Retained for HTTP interface) ==========

// MCPReportMeta metadata for MCP report.
type MCPReportMeta struct {
	ID        string `json:"id"`        // Report unique ID
	CreatedAt int64  `json:"createdAt"` // Creation timestamp (ms)
	Agent     string `json:"agent"`     // Agent identifier
	Total     int    `json:"total"`     // Total issues
	High      int    `json:"high"`      // High severity issues
	Medium    int    `json:"medium"`    // Medium severity issues
	Low       int    `json:"low"`       // Low severity issues
}

// MCPIssue represents a single security issue in an MCP report.
type MCPIssue struct {
	Severity    string `json:"severity"`    // Severity
	Rule        string `json:"rule"`        // Rule name
	File        string `json:"file"`        // File path
	Line        int    `json:"line"`        // Line number
	Title       string `json:"title"`       // Issue title
	Evidence    string `json:"evidence"`    // Evidence
	Remediation string `json:"remediation"` // Remediation suggestion
}

// MCPReport complete MCP report, containing metadata and issue list.
type MCPReport struct {
	Meta   MCPReportMeta `json:"meta"`   // Report metadata
	Issues []MCPIssue    `json:"issues"` // Issue list
}
