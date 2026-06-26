package httpclient

import (
	"net"
	"net/http"
	"time"
)

// SharedTransport HTTP Transport shared globally, recycling connections.
var SharedTransport = &http.Transport{
	MaxIdleConns:        100,
	MaxIdleConnsPerHost: 10,
	IdleConnTimeout:     90 * time.Second,
	DialContext: (&net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext,
}

// DefaultClient default HTTP client using shared Transport.
var DefaultClient = &http.Client{
	Transport: SharedTransport,
	Timeout:   60 * time.Second,
}

// NewClientWithTimeout creates an HTTP client with specific timeout, reusing shared Transport.
func NewClientWithTimeout(timeout time.Duration) *http.Client {
	return &http.Client{
		Transport: SharedTransport,
		Timeout:   timeout,
	}
}
