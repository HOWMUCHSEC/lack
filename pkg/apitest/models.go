package apitest

// Request represents API test request parameters.
type Request struct {
	BaseURL        string `json:"base_url"`        // Target URL
	RequestHeaders string `json:"request_headers"` // Request headers JSON string
	RequestBody    string `json:"request_body"`    // Request body JSON string
	Method         string `json:"method"`          // HTTP method
	TimeoutMs      int    `json:"timeout_ms"`      // Timeout in milliseconds
}

// Response represents API test result.
type Response struct {
	Success      bool              `json:"success"`       // Whether success
	StatusCode   int               `json:"status_code"`   // HTTP status code
	ResponseBody string            `json:"response_body"` // Response body
	ResponseTime int64             `json:"response_time"` // Response time in milliseconds
	Error        string            `json:"error"`         // Error message
	Headers      map[string]string `json:"headers"`       // Response headers
}
