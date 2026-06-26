package cloudscan

// SourceType identifies the kind of input being scanned.
type SourceType string

const (
	SourceTypeContent         SourceType = "content"
	SourceTypeRepository      SourceType = "repository"
	SourceTypeLocalRepository SourceType = "localRepository"
)

// ScanRequest is the Wails-facing request shape for AI cloud posture scans.
type ScanRequest struct {
	SourceType SourceType `json:"sourceType"`
	Target     string     `json:"target"`
	Content    string     `json:"content,omitempty"`
}

// EngineStatus describes the locally integrated open-source scan engine.
type EngineStatus struct {
	Available      bool     `json:"available"`
	Engine         string   `json:"engine"`
	Repository     string   `json:"repository"`
	Path           string   `json:"path,omitempty"`
	Error          string   `json:"error,omitempty"`
	InstallHint    string   `json:"installHint,omitempty"`
	CandidatePaths []string `json:"candidatePaths,omitempty"`
}

// SeverityCounts contains normalized finding counts by severity.
type SeverityCounts struct {
	Critical int `json:"critical"`
	High     int `json:"high"`
	Medium   int `json:"medium"`
	Low      int `json:"low"`
	Unknown  int `json:"unknown"`
}

// ScanMetrics contains UI summary metrics derived from scan findings.
type ScanMetrics struct {
	Compliance      int `json:"compliance"`
	IAMRisks        int `json:"iamRisks"`
	PublicAssets    int `json:"publicAssets"`
	Secrets         int `json:"secrets"`
	Misconfigs      int `json:"misconfigs"`
	FilesScanned    int `json:"filesScanned"`
	TotalFindings   int `json:"totalFindings"`
	PassedChecks    int `json:"passedChecks"`
	FailedChecks    int `json:"failedChecks"`
	ExceptionChecks int `json:"exceptionChecks"`
}

// Finding is the normalized finding shape consumed by the frontend.
type Finding struct {
	ID          string   `json:"id"`
	Type        string   `json:"type"`
	Severity    string   `json:"severity"`
	Title       string   `json:"title"`
	Description string   `json:"description,omitempty"`
	Message     string   `json:"message,omitempty"`
	Resource    string   `json:"resource,omitempty"`
	Provider    string   `json:"provider,omitempty"`
	Service     string   `json:"service,omitempty"`
	FilePath    string   `json:"filePath,omitempty"`
	StartLine   int      `json:"startLine,omitempty"`
	EndLine     int      `json:"endLine,omitempty"`
	Resolution  string   `json:"resolution,omitempty"`
	PrimaryURL  string   `json:"primaryUrl,omitempty"`
	References  []string `json:"references,omitempty"`
}

// ScanResult is the normalized scan report returned to the UI.
type ScanResult struct {
	ID             string         `json:"id"`
	Target         string         `json:"target"`
	SourceType     SourceType     `json:"sourceType"`
	Engine         string         `json:"engine"`
	ScannedAt      int64          `json:"scannedAt"`
	Score          int            `json:"score"`
	Summary        string         `json:"summary"`
	SeverityCounts SeverityCounts `json:"severityCounts"`
	Metrics        ScanMetrics    `json:"metrics"`
	Findings       []Finding      `json:"findings"`
}
