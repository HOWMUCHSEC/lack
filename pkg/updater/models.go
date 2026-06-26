package updater

// CheckResult contains the result of an update check.
type CheckResult struct {
	CurrentVersion string `json:"current_version"` // Current version
	LatestVersion  string `json:"latest_version"`  // Latest version
	HasUpdate      bool   `json:"has_update"`      // Whether an update is available
	RawBody        string `json:"raw_body"`        // Raw response body
	LastUpdated    string `json:"last_updated"`    // Last updated time
	Error          string `json:"error"`           // Error message
}
