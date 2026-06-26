package cloudscan

import "embed"

// kicsQueriesFS contains the slim runtime query set copied from Checkmarx KICS.
// It intentionally excludes upstream test fixtures and keeps only query metadata,
// Rego files, query data needed at scan time, and the upstream KICS license.
//
//go:embed all:kics-queries
var kicsQueriesFS embed.FS
