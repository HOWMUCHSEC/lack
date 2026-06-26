package mcpserver

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGenerateAuthToken(t *testing.T) {
	first, err := generateAuthToken()
	if err != nil {
		t.Fatalf("generate first token: %v", err)
	}
	second, err := generateAuthToken()
	if err != nil {
		t.Fatalf("generate second token: %v", err)
	}
	if first == "" || second == "" {
		t.Fatal("expected non-empty tokens")
	}
	if first == second {
		t.Fatal("expected startup tokens to be random")
	}
}

func TestTokenFromRequest(t *testing.T) {
	tests := []struct {
		name     string
		mutate   func(*http.Request)
		expected string
	}{
		{
			name: "x mcp token header",
			mutate: func(r *http.Request) {
				r.Header.Set("X-MCP-Token", "header-token")
			},
			expected: "header-token",
		},
		{
			name: "bearer token",
			mutate: func(r *http.Request) {
				r.Header.Set("Authorization", "Bearer bearer-token")
			},
			expected: "bearer-token",
		},
		{
			name: "query token",
			mutate: func(r *http.Request) {
				q := r.URL.Query()
				q.Set("token", "query-token")
				r.URL.RawQuery = q.Encode()
			},
			expected: "query-token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/v1/report", nil)
			tt.mutate(req)
			if got := tokenFromRequest(req); got != tt.expected {
				t.Fatalf("tokenFromRequest() = %q, want %q", got, tt.expected)
			}
		})
	}
}

func TestAuthenticateRequest(t *testing.T) {
	svc := NewService()
	svc.authTokenValue.Store("expected-token")

	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/v1/report", nil)
	req.Header.Set("Authorization", "Bearer expected-token")
	if !svc.authenticateRequest(httptest.NewRecorder(), req) {
		t.Fatal("expected valid bearer token to authenticate")
	}

	req = httptest.NewRequest(http.MethodPost, "http://127.0.0.1/v1/report", nil)
	req.Header.Set("Authorization", "Bearer wrong-token")
	rr := httptest.NewRecorder()
	if svc.authenticateRequest(rr, req) {
		t.Fatal("expected invalid bearer token to be rejected")
	}
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("invalid token status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
}

func TestAuthenticateRequestUnavailableToken(t *testing.T) {
	svc := NewService()

	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/v1/report", nil)
	rr := httptest.NewRecorder()
	if svc.authenticateRequest(rr, req) {
		t.Fatal("expected authentication to fail when server token is unavailable")
	}
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("unavailable token status = %d, want %d", rr.Code, http.StatusServiceUnavailable)
	}
}

func TestIsAllowedOrigin(t *testing.T) {
	tests := []struct {
		name    string
		origin  string
		allowed bool
	}{
		{name: "no origin", allowed: true},
		{name: "localhost", origin: "http://localhost:5173", allowed: true},
		{name: "localhost subdomain", origin: "wails://app.localhost", allowed: true},
		{name: "ipv4 loopback", origin: "http://127.0.0.1:5173", allowed: true},
		{name: "ipv6 loopback", origin: "http://[::1]:5173", allowed: true},
		{name: "remote host", origin: "https://example.com", allowed: false},
		{name: "localhost suffix attack", origin: "http://localhost.evil.test", allowed: false},
		{name: "unsupported scheme", origin: "chrome-extension://abc", allowed: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/v1/ws", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			if got := isAllowedOrigin(req); got != tt.allowed {
				t.Fatalf("isAllowedOrigin() = %v, want %v", got, tt.allowed)
			}
		})
	}
}

func TestStatusForStorageStripsAuthToken(t *testing.T) {
	st := statusForStorage(LocalServerStatus{
		Running:   true,
		Endpoint:  "ws://127.0.0.1:12345/v1/ws",
		AuthToken: "secret-token",
		Port:      12345,
		StartedAt: 1,
	})

	if st.AuthToken != "" {
		t.Fatalf("statusForStorage preserved auth token %q", st.AuthToken)
	}
	if !st.Running || st.Endpoint == "" || st.Port == 0 || st.StartedAt == 0 {
		t.Fatalf("statusForStorage unexpectedly changed non-secret fields: %+v", st)
	}
}

func TestCORSMiddlewareRejectsRemoteOrigin(t *testing.T) {
	called := false
	handler := mwCORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/v1/health", nil)
	req.Header.Set("Origin", "https://example.com")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if called {
		t.Fatal("expected remote origin to be rejected before reaching the handler")
	}
	if rr.Code != http.StatusForbidden {
		t.Fatalf("remote origin status = %d, want %d", rr.Code, http.StatusForbidden)
	}
}

func TestCORSMiddlewareAllowsLoopbackPreflight(t *testing.T) {
	handler := mwCORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("preflight should not reach the wrapped handler")
	}))

	req := httptest.NewRequest(http.MethodOptions, "http://127.0.0.1/v1/report", nil)
	req.Header.Set("Origin", "http://127.0.0.1:5173")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("loopback preflight status = %d, want %d", rr.Code, http.StatusNoContent)
	}
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://127.0.0.1:5173" {
		t.Fatalf("Access-Control-Allow-Origin = %q", got)
	}
	if got := rr.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(got, "X-MCP-Token") {
		t.Fatalf("Access-Control-Allow-Headers = %q, want X-MCP-Token", got)
	}
}

func TestHandleReportRequiresAuth(t *testing.T) {
	svc := NewService()
	svc.authTokenValue.Store("expected-token")

	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/v1/report", strings.NewReader(`{"agent":"agent","issues":[]}`))
	rr := httptest.NewRecorder()

	svc.handleReport(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("missing token status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
}

func TestHandleReportBodyLimit(t *testing.T) {
	svc := NewService()
	svc.authTokenValue.Store("expected-token")

	body := bytes.Repeat([]byte(" "), maxReportBodyBytes+1)
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/v1/report", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer expected-token")
	rr := httptest.NewRecorder()

	svc.handleReport(rr, req)

	if rr.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized report status = %d, want %d", rr.Code, http.StatusRequestEntityTooLarge)
	}
}
