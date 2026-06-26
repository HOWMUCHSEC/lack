package yamlscan

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func stubYAMLStoragePut(t *testing.T, fn func([]byte, []byte) error) {
	t.Helper()
	orig := storagePut
	storagePut = fn
	t.Cleanup(func() {
		storagePut = orig
	})
}

func TestFetchFromGitHubRejectsDisallowedURLs(t *testing.T) {
	tests := []string{
		"http://github.com/owner/repo/blob/main/workflow.yml",
		"https://example.com/owner/repo/blob/main/workflow.yml",
		"file:///tmp/workflow.yml",
		"https://github.evil.test/owner/repo/blob/main/workflow.yml",
	}

	for _, input := range tests {
		t.Run(input, func(t *testing.T) {
			if _, err := FetchFromGitHub(input); err == nil {
				t.Fatal("expected URL to be rejected")
			}
		})
	}
}

func TestCheckGitHubRedirectRejectsDisallowedHost(t *testing.T) {
	req, err := http.NewRequest(http.MethodGet, "https://evil.example/workflow.yml", nil)
	if err != nil {
		t.Fatalf("NewRequest: %v", err)
	}
	if err := checkGitHubRedirect(req, nil); err == nil {
		t.Fatal("expected redirect to disallowed host to fail")
	}
}

func TestFetchFromGitHubRejectsOversizedResponse(t *testing.T) {
	origClient := httpClient
	httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(strings.Repeat("a", maxGitHubFetchBytes+1))),
				Request:    req,
			}, nil
		}),
		CheckRedirect: checkGitHubRedirect,
	}
	t.Cleanup(func() {
		httpClient = origClient
	})

	_, err := FetchFromGitHub("https://raw.githubusercontent.com/owner/repo/main/workflow.yml")
	if err == nil {
		t.Fatal("expected oversized response to fail")
	}
	if !strings.Contains(err.Error(), "exceeds") {
		t.Fatalf("expected size limit error, got %v", err)
	}
}

func TestScanYAMLReportsWorkflowStructureFailure(t *testing.T) {
	stubYAMLStoragePut(t, func([]byte, []byte) error { return nil })

	result, err := ScanYAML(ScanRequest{
		Content: "name: broken\njobs: []\n",
	})
	if err != nil {
		t.Fatalf("ScanYAML returned unexpected error: %v", err)
	}
	if !result.Valid {
		t.Fatal("expected syntactically valid YAML")
	}
	if result.Safe {
		t.Fatal("expected malformed workflow structure to be unsafe")
	}
	if len(result.Findings) == 0 {
		t.Fatal("expected a structure diagnostic finding")
	}
	if result.Findings[0].RuleID != "WorkflowFile-StructureInvalid" {
		t.Fatalf("unexpected finding rule: %s", result.Findings[0].RuleID)
	}
}

func TestScanYAMLReturnsSaveResultError(t *testing.T) {
	saveErr := errors.New("disk is full")
	stubYAMLStoragePut(t, func([]byte, []byte) error { return saveErr })

	result, err := ScanYAML(ScanRequest{
		Content: "name: ok\non: push\njobs:\n  build:\n    steps:\n      - run: echo hi\n",
	})
	if !errors.Is(err, saveErr) {
		t.Fatalf("expected save error, got %v", err)
	}
	if result.Safe {
		t.Fatal("expected save failure to mark result unsafe")
	}
	if !strings.Contains(result.Error, "save scan result failed") {
		t.Fatalf("expected save failure in result error, got %q", result.Error)
	}
}
