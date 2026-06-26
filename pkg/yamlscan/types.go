package yamlscan

// ScanRequest represents a scan request.
type ScanRequest struct {
	Content   string `json:"content"`   // YAML content
	SourceURL string `json:"sourceUrl"` // Optional: GitHub URL (for recording source)
}

// ScanResult represents the scan result.
type ScanResult struct {
	ID        string    `json:"id"`        // Scan record ID
	Valid     bool      `json:"valid"`     // Whether YAML format is valid
	Safe      bool      `json:"safe"`      // Whether safe
	Findings  []Finding `json:"findings"`  // Matched findings
	Error     string    `json:"error"`     // Error message
	Summary   Summary   `json:"summary"`   // Scan summary
	ScannedAt string    `json:"scannedAt"` // Scan time (ISO8601)
	SourceURL string    `json:"sourceUrl"` // Source URL
}

// Finding represents a single risk finding.
type Finding struct {
	Line        int      `json:"line"`        // Line number (0 indicates file level)
	RuleID      string   `json:"ruleId"`      // Rule ID
	Matched     []string `json:"matched"`     // Matched content
	Context     string   `json:"context"`     // Context snippet
	Severity    string   `json:"severity"`    // Severity: critical/high/medium/low
	Category    string   `json:"category"`    // Category: promptpwnd/misconfig
	Description string   `json:"description"` // Risk description
	Suggestion  string   `json:"suggestion"`  // Suggestion
}

// Summary represents scan summary.
type Summary struct {
	TotalLines    int `json:"totalLines"`    // Total lines
	CriticalCount int `json:"criticalCount"` // Critical count
	HighCount     int `json:"highCount"`     // High count
	MediumCount   int `json:"mediumCount"`   // Medium count
	LowCount      int `json:"lowCount"`      // Low count
}

// ScanHistory represents scan history record.
type ScanHistory struct {
	ID            string `json:"id"`
	SourceURL     string `json:"sourceUrl"`
	Safe          bool   `json:"safe"`
	CriticalCount int    `json:"criticalCount"`
	HighCount     int    `json:"highCount"`
	MediumCount   int    `json:"mediumCount"`
	LowCount      int    `json:"lowCount"`
	ScannedAt     string `json:"scannedAt"` // ISO8601
}

// WorkflowFile represents GitHub Actions workflow file structure.
type WorkflowFile struct {
	Name string                 `yaml:"name"`
	On   interface{}            `yaml:"on"`
	Env  map[string]string      `yaml:"env"`
	Jobs map[string]WorkflowJob `yaml:"jobs"`
}

// WorkflowJob represents a workflow job.
type WorkflowJob struct {
	Name  string            `yaml:"name"`
	Env   map[string]string `yaml:"env"`
	Steps []WorkflowStep    `yaml:"steps"`
}

// WorkflowStep represents a workflow step.
type WorkflowStep struct {
	Name string            `yaml:"name"`
	Uses string            `yaml:"uses"`
	With map[string]string `yaml:"with"`
	Env  map[string]string `yaml:"env"`
	Run  string            `yaml:"run"`
}
