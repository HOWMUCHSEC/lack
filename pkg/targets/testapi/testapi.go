package testapi

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptrace"
	"strings"
	"time"

	"lack-client/pkg/logger"
)

const (
	// MaxResponseBodyBytes bounds memory/disk use for previews and persisted scan steps.
	MaxResponseBodyBytes = 1 << 20
	// MaxRequestBodyBytes bounds memory/network use for direct API tests.
	MaxRequestBodyBytes = 1 << 20
	// MaxRequestHeaderBytes bounds header JSON accepted by direct API tests.
	MaxRequestHeaderBytes = 64 << 10
	// MaxRequestURLBytes prevents pathological URL inputs from reaching net/http.
	MaxRequestURLBytes = 8 << 10
	// MaxTimeoutMs keeps direct API tests from hanging the local scanner for too long.
	MaxTimeoutMs = 120000
)

// sharedTransport shared HTTP Transport recycling connection pool.
var sharedTransport = &http.Transport{
	MaxIdleConns:        100,
	MaxIdleConnsPerHost: 20,
	IdleConnTimeout:     90 * time.Second,
}

// Request describes parameters for an API test request.
type Request struct {
	BaseURL        string `json:"base_url"`
	RequestHeaders string `json:"request_headers"`
	RequestBody    string `json:"request_body"`
	Method         string `json:"method"`
	TimeoutMs      int    `json:"timeout_ms"`
}

// Response represents the test result.
type Response struct {
	Success      bool              `json:"success"`
	StatusCode   int               `json:"status_code"`
	ResponseBody string            `json:"response_body"`
	ResponseTime int64             `json:"response_time"` // Milliseconds
	Error        string            `json:"error"`
	Headers      map[string]string `json:"headers"`
}

// DoTest 按参数发起一次 HTTP 请求并返回结果（包含丰富调试日志）
func DoTest(ctx context.Context, request Request) Response {
	startTime := time.Now()

	logger.Info("Starting API connection test",
		"base_url", request.BaseURL,
		"method", request.Method,
		"timeout_ms", request.TimeoutMs,
	)

	if len(request.BaseURL) > MaxRequestURLBytes {
		return Response{Success: false, Error: fmt.Sprintf("request URL exceeds hard limit: got %d bytes, max %d", len(request.BaseURL), MaxRequestURLBytes)}
	}
	if len(request.RequestHeaders) > MaxRequestHeaderBytes {
		return Response{Success: false, Error: fmt.Sprintf("request headers exceed hard limit: got %d bytes, max %d", len(request.RequestHeaders), MaxRequestHeaderBytes)}
	}
	if len(request.RequestBody) > MaxRequestBodyBytes {
		return Response{Success: false, Error: fmt.Sprintf("request body exceeds hard limit: got %d bytes, max %d", len(request.RequestBody), MaxRequestBodyBytes)}
	}
	if request.TimeoutMs > MaxTimeoutMs {
		return Response{Success: false, Error: fmt.Sprintf("timeout exceeds hard limit: got %dms, max %dms", request.TimeoutMs, MaxTimeoutMs)}
	}

	// Normalize method & timeout
	method := strings.ToUpper(strings.TrimSpace(request.Method))
	if method == "" {
		method = "POST"
	}
	timeout := 5 * time.Second
	if request.TimeoutMs > 0 {
		timeout = time.Duration(request.TimeoutMs) * time.Millisecond
	}

	// Parse request headers
	headers := make(map[string]string)
	if strings.TrimSpace(request.RequestHeaders) != "" {
		if err := json.Unmarshal([]byte(request.RequestHeaders), &headers); err != nil {
			logger.Error("Failed to parse request headers", "error", err, "header_bytes", len(request.RequestHeaders))
			return Response{Success: false, Error: fmt.Sprintf("failed to parse request headers: %v", err)}
		}
		logger.Debug("Request headers parsed successfully", "headers", maskHeadersMap(headers))
	}

	// Parse request body
	var requestBodyData interface{}
	if strings.TrimSpace(request.RequestBody) != "" {
		if err := json.Unmarshal([]byte(request.RequestBody), &requestBodyData); err != nil {
			previewLen := 100
			if len(request.RequestBody) < previewLen {
				previewLen = len(request.RequestBody)
			}
			logger.Error("Failed to parse request body", "error", err, "body_preview", request.RequestBody[:previewLen])
			return Response{Success: false, Error: fmt.Sprintf("failed to parse request body: %v", err)}
		}
		logger.Debug("Request body parsed successfully")
	}

	// Build request body (GET has no body)
	var bodyReader io.Reader
	if requestBodyData != nil && method != "GET" {
		bodyBytes, err := json.Marshal(requestBodyData)
		if err != nil {
			logger.Error("Failed to serialize request body", "error", err)
			return Response{Success: false, Error: fmt.Sprintf("failed to serialize request body: %v", err)}
		}
		if len(bodyBytes) > MaxRequestBodyBytes {
			return Response{Success: false, Error: fmt.Sprintf("serialized request body exceeds hard limit: got %d bytes, max %d", len(bodyBytes), MaxRequestBodyBytes)}
		}
		bodyReader = bytes.NewBuffer(bodyBytes)
		logger.Debug("Request body size", "bytes", len(bodyBytes))
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, method, request.BaseURL, bodyReader)
	if err != nil {
		logger.Error("Failed to create HTTP request", "error", err, "url", request.BaseURL)
		return Response{Success: false, Error: fmt.Sprintf("failed to create request: %v", err)}
	}

	// Set default Content-Type
	req.Header.Set("Content-Type", "application/json")
	// Set custom headers
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	logger.Debug("Request headers set", "header_count", len(req.Header), "final_headers", maskHTTPHeader(req.Header))

	// Set httptrace
	trace := &httptrace.ClientTrace{
		DNSStart:     func(info httptrace.DNSStartInfo) { logger.Debug("trace: DNSStart", "host", info.Host) },
		DNSDone:      func(info httptrace.DNSDoneInfo) { logger.Debug("trace: DNSDone", "addrs", info.Addrs, "err", info.Err) },
		ConnectStart: func(network, addr string) { logger.Debug("trace: ConnectStart", "network", network, "addr", addr) },
		ConnectDone: func(network, addr string, err error) {
			logger.Debug("trace: ConnectDone", "network", network, "addr", addr, "err", err)
		},
		TLSHandshakeStart: func() { logger.Debug("trace: TLSHandshakeStart") },
		TLSHandshakeDone:  func(cs tls.ConnectionState, err error) { logger.Debug("trace: TLSHandshakeDone", "err", err) },
		GotConn: func(info httptrace.GotConnInfo) {
			logger.Debug("trace: GotConn", "reused", info.Reused, "idle_time", info.IdleTime)
		},
		WroteHeaders:         func() { logger.Debug("trace: WroteHeaders") },
		WroteRequest:         func(info httptrace.WroteRequestInfo) { logger.Debug("trace: WroteRequest", "err", info.Err) },
		GotFirstResponseByte: func() { logger.Debug("trace: GotFirstResponseByte") },
	}
	req = req.WithContext(httptrace.WithClientTrace(req.Context(), trace))

	var bodyPreview string
	if strings.TrimSpace(request.RequestBody) != "" {
		if len(request.RequestBody) > 1000 {
			bodyPreview = request.RequestBody[:1000] + "..."
		} else {
			bodyPreview = request.RequestBody
		}
	}
	client := &http.Client{Transport: sharedTransport, Timeout: timeout}
	logger.Info("Sending HTTP request", "method", method, "url", request.BaseURL, "timeout_ms", client.Timeout.Milliseconds())
	logger.Debug("Request body preview", "body_preview", bodyPreview)

	resp, err := client.Do(req)
	if err != nil {
		logger.Error("HTTP request failed", "error", err, "elapsed_ms", time.Since(startTime).Milliseconds())
		return Response{Success: false, Error: fmt.Sprintf("request failed: %v", err), ResponseTime: time.Since(startTime).Milliseconds()}
	}
	defer resp.Body.Close()

	logger.Info("Received HTTP response",
		"status_code", resp.StatusCode,
		"content_length", resp.ContentLength,
		"elapsed_ms", time.Since(startTime).Milliseconds(),
	)

	// Read a bounded response body so a target cannot exhaust memory/disk.
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, MaxResponseBodyBytes+1))
	if err != nil {
		logger.Error("Failed to read response body", "error", err, "status_code", resp.StatusCode)
		return Response{Success: false, StatusCode: resp.StatusCode, Error: fmt.Sprintf("failed to read response: %v", err), ResponseTime: time.Since(startTime).Milliseconds()}
	}
	truncated := len(responseBody) > MaxResponseBodyBytes
	if truncated {
		responseBody = responseBody[:MaxResponseBodyBytes]
		responseBody = append(responseBody, []byte("\n[response truncated after 1048576 bytes]")...)
	}

	logger.Debug("Response body read successfully", "body_size", len(responseBody), "truncated", truncated)

	// Collect response headers
	responseHeaders := make(map[string]string)
	for key, values := range resp.Header {
		if len(values) > 0 {
			responseHeaders[key] = values[0]
		}
	}

	result := Response{
		Success:      resp.StatusCode >= 200 && resp.StatusCode < 300,
		StatusCode:   resp.StatusCode,
		ResponseBody: string(responseBody),
		ResponseTime: time.Since(startTime).Milliseconds(),
		Headers:      responseHeaders,
		Error:        "",
	}

	logger.Info("API test completed",
		"success", result.Success,
		"status_code", result.StatusCode,
		"response_time_ms", result.ResponseTime,
		"response_size", len(responseBody),
		"response_truncated", truncated,
	)

	return result
}

// Helper function for masking
func maskHeadersMap(m map[string]string) map[string]string {
	out := make(map[string]string, len(m))
	for k, v := range m {
		lk := strings.ToLower(k)
		if lk == "authorization" || lk == "api-key" || lk == "x-api-key" {
			out[k] = maskToken(v)
		} else {
			out[k] = v
		}
	}
	return out
}

func maskHTTPHeader(h http.Header) map[string]string {
	out := make(map[string]string, len(h))
	for k, vals := range h {
		if len(vals) == 0 {
			continue
		}
		v := vals[0]
		lk := strings.ToLower(k)
		if lk == "authorization" || lk == "api-key" || lk == "x-api-key" {
			out[k] = maskToken(v)
		} else {
			out[k] = v
		}
	}
	return out
}

func maskToken(token string) string {
	if len(token) <= 10 {
		return "***"
	}
	return token[:4] + "..." + token[len(token)-4:]
}
