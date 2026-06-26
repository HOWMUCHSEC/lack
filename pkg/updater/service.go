package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	// UpdateCheckURL is the endpoint URL for version update checks.
	UpdateCheckURL = "https://lack.oss-ap-southeast-1.aliyuncs.com/version.json"
	// DefaultUpdateTimeout is the default timeout for update checks.
	DefaultUpdateTimeout = 5 * time.Second
)

// getUpdateTimeout gets timeout setting from environment variables or uses default.
func getUpdateTimeout() time.Duration {
	if v := strings.TrimSpace(os.Getenv("LACK_UPDATE_TIMEOUT_MS")); v != "" {
		if ms, err := strconv.Atoi(v); err == nil && ms > 0 {
			return time.Duration(ms) * time.Millisecond
		}
	}
	if v := strings.TrimSpace(os.Getenv("LACK_UPDATE_TIMEOUT_SECONDS")); v != "" {
		if s, err := strconv.Atoi(v); err == nil && s > 0 {
			return time.Duration(s) * time.Second
		}
	}
	return DefaultUpdateTimeout
}

// CheckForUpdate checks if a new version is available.
func CheckForUpdate(ctx context.Context, currentVersion string) CheckResult {
	res := CheckResult{
		CurrentVersion: strings.TrimSpace(currentVersion),
	}
	
	if ctx == nil {
		ctx = context.Background()
	}
	
	timeout := getUpdateTimeout()
	ctx2, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	
	req, err := http.NewRequestWithContext(ctx2, http.MethodGet, UpdateCheckURL, nil)
	if err != nil {
		res.Error = err.Error()
		return res
	}
	
	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		res.Error = err.Error()
		return res
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		res.Error = err.Error()
		return res
	}
	
	res.RawBody = string(body)
	
	var payload struct {
		Version  string `json:"version"`
		Metadata struct {
			LastUpdated string `json:"lastUpdated"`
		} `json:"metadata"`
	}
	
	if err := json.Unmarshal(body, &payload); err != nil {
		res.Error = fmt.Sprintf("invalid version payload: %v", err)
		return res
	}
	
	res.LatestVersion = strings.TrimSpace(payload.Version)
	res.LastUpdated = strings.TrimSpace(payload.Metadata.LastUpdated)
	
	cv := strings.TrimPrefix(strings.TrimSpace(res.CurrentVersion), "v")
	lv := strings.TrimPrefix(strings.TrimSpace(res.LatestVersion), "v")
	
	if lv != "" && cv != "" && lv != cv {
		res.HasUpdate = true
	}
	
	return res
}
