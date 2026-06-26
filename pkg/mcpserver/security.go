package mcpserver

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"net"
	"net/http"
	"net/url"
	"strings"
)

const (
	mcpAuthTokenBytes  = 32
	maxReportBodyBytes = 10 << 20
	maxWSMessageBytes  = 1 << 20
)

func generateAuthToken() (string, error) {
	token := make([]byte, mcpAuthTokenBytes)
	if _, err := rand.Read(token); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(token), nil
}

func tokenFromRequest(r *http.Request) string {
	if r == nil {
		return ""
	}
	if token := strings.TrimSpace(r.Header.Get("X-MCP-Token")); token != "" {
		return token
	}
	if auth := strings.TrimSpace(r.Header.Get("Authorization")); auth != "" {
		parts := strings.Fields(auth)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			return parts[1]
		}
	}
	if token := strings.TrimSpace(r.URL.Query().Get("token")); token != "" {
		return token
	}
	return strings.TrimSpace(r.URL.Query().Get("access_token"))
}

func (s *Service) authenticateRequest(w http.ResponseWriter, r *http.Request) bool {
	expected := s.authToken()
	if expected == "" {
		http.Error(w, "server token unavailable", http.StatusServiceUnavailable)
		return false
	}
	if subtle.ConstantTimeCompare([]byte(tokenFromRequest(r)), []byte(expected)) != 1 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return false
	}
	return true
}

func (s *Service) authToken() string {
	if s == nil {
		return ""
	}
	token, _ := s.authTokenValue.Load().(string)
	return token
}

func statusForStorage(st LocalServerStatus) LocalServerStatus {
	st.AuthToken = ""
	return st
}

func isAllowedOrigin(r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return true
	}

	parsed, err := url.Parse(origin)
	if err != nil || parsed.Host == "" {
		return false
	}

	switch strings.ToLower(parsed.Scheme) {
	case "http", "https", "wails":
	default:
		return false
	}

	return isAllowedLoopbackHost(parsed.Hostname())
}

func isAllowedLoopbackHost(host string) bool {
	host = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(host)), ".")
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return true
	}

	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
