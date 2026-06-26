package cloudscan

import "time"

type kicsSummary struct {
	Version          string            `json:"kics_version"`
	FilesScanned     int               `json:"files_scanned"`
	FilesParsed      int               `json:"files_parsed"`
	TotalQueries     int               `json:"queries_total"`
	FailedQueries    int               `json:"queries_failed_to_execute"`
	TotalCounter     int               `json:"total_counter"`
	SeverityCounters map[string]int    `json:"severity_counters"`
	Times            kicsTimes         `json:"-"`
	ScannedPaths     []string          `json:"paths"`
	Queries          []kicsQueryResult `json:"queries"`
}

type kicsTimes struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

type kicsQueryResult struct {
	QueryName     string               `json:"query_name"`
	QueryID       string               `json:"query_id"`
	QueryURL      string               `json:"query_url"`
	Severity      string               `json:"severity"`
	Platform      string               `json:"platform"`
	CWE           string               `json:"cwe"`
	RiskScore     string               `json:"risk_score"`
	CloudProvider string               `json:"cloud_provider"`
	Category      string               `json:"category"`
	Description   string               `json:"description"`
	DescriptionID string               `json:"description_id"`
	Files         []kicsVulnerableFile `json:"files"`
}

type kicsVulnerableFile struct {
	FileName         string  `json:"file_name"`
	SimilarityID     string  `json:"similarity_id"`
	Line             int     `json:"line"`
	ResourceType     string  `json:"resource_type"`
	ResourceName     string  `json:"resource_name"`
	IssueType        string  `json:"issue_type"`
	SearchKey        string  `json:"search_key"`
	SearchLine       int     `json:"search_line"`
	SearchValue      string  `json:"search_value"`
	KeyExpectedValue string  `json:"expected_value"`
	KeyActualValue   string  `json:"actual_value"`
	Value            *string `json:"value"`
	Remediation      string  `json:"remediation"`
	RemediationType  string  `json:"remediation_type"`
}
