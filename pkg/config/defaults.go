package config

import (
	"os"
	"strconv"
)

func init() {
	// Read Sentry config from environment variables
	if dsn := os.Getenv("SENTRY_DSN"); dsn != "" {
		SentryDSN = dsn
	}
	if env := os.Getenv("SENTRY_ENVIRONMENT"); env != "" {
		SentryEnvironment = env
	}
	if rate := os.Getenv("SENTRY_TRACES_SAMPLE_RATE"); rate != "" {
		if f, err := strconv.ParseFloat(rate, 64); err == nil {
			SentryTracesSampleRate = f
		}
	}
}

// Scanner default configuration.
const (
	// DefaultConcurrency default concurrency.
	DefaultConcurrency = 10

	// DefaultMaxRetries default max retries.
	DefaultMaxRetries = 3

	// DefaultPerAttemptTimeoutMs default per attempt timeout in milliseconds.
	DefaultPerAttemptTimeoutMs = 8000

	// DefaultBaseBackoffMs default base backoff in milliseconds.
	DefaultBaseBackoffMs = 500

	// DefaultMaxBackoffMs default max backoff in milliseconds.
	DefaultMaxBackoffMs = 4000

	// DefaultJitterPct default jitter percentage.
	DefaultJitterPct = 0

	// DefaultAbortAfterFailures default abort after consecutive failures (0=no abort).
	DefaultAbortAfterFailures = 0
)

// Evaluator default configuration.
const (
	// DefaultEvalConcurrency default evaluator concurrency.
	DefaultEvalConcurrency = 5

	// DefaultEvalTimeoutMs default evaluation timeout in milliseconds.
	DefaultEvalTimeoutMs = 30000

	// DefaultEvalMaxRetries default evaluation max retries.
	DefaultEvalMaxRetries = 3

	// DefaultHTTPClientTimeoutMs default HTTP client global timeout in milliseconds, acting as fallback.
	// Frontend form timeout configuration has higher priority.
	DefaultHTTPClientTimeoutMs = 120000
)

// Pagination default configuration.
const (
	// DefaultPageLimit default page limit.
	DefaultPageLimit = 50

	// DefaultLargePageLimit large page limit.
	DefaultLargePageLimit = 100
)

// HTTP status code classification default values.
var (
	// DefaultExpectedSuccess default success status codes.
	DefaultExpectedSuccess = []string{"200-299"}

	// DefaultRetryOn default retry status codes.
	DefaultRetryOn = []string{"408", "429", "500-599"}

	// DefaultFailOn default fail status codes.
	DefaultFailOn = []string{"400-499"}
)

// Badger GC configuration.
const (
	// GCInterval GC execution interval in minutes.
	GCInterval = 5

	// GCDiscardRatio GC discard ratio (0.5 = 50%).
	GCDiscardRatio = 0.5
)

// Sentry configuration (can be overridden by environment variables).
var (
	// SentryDSN Sentry DSN (Environment variable: SENTRY_DSN). Empty disables telemetry.
	SentryDSN = ""

	// SentryEnvironment Environment identifier (Environment variable: SENTRY_ENVIRONMENT).
	SentryEnvironment = "development"

	// SentryTracesSampleRate Traces sample rate.
	SentryTracesSampleRate = 0.0
)
