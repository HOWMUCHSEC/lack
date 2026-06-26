// Package logger provides unified logging functionality based on Go's official slog package.
package logger

import (
	"log/slog"
	"os"
	"sync"
)

var (
	defaultLogger *slog.Logger
	once          sync.Once
)

// Init initializes the logger, choosing between JSON or Text format.
func Init(jsonFormat bool) {
	once.Do(func() {
		var handler slog.Handler
		opts := &slog.HandlerOptions{
			Level: slog.LevelDebug,
		}

		if jsonFormat {
			handler = slog.NewJSONHandler(os.Stdout, opts)
		} else {
			handler = slog.NewTextHandler(os.Stdout, opts)
		}

		defaultLogger = slog.New(handler)
		slog.SetDefault(defaultLogger)
	})
}

// L returns the default slog.Logger instance.
func L() *slog.Logger {
	if defaultLogger == nil {
		Init(false)
	}
	return defaultLogger
}

// Debug logs at Debug level.
func Debug(msg string, args ...any) {
	L().Debug(msg, args...)
}

// Info logs at Info level.
func Info(msg string, args ...any) {
	L().Info(msg, args...)
}

// Warn logs at Warn level.
func Warn(msg string, args ...any) {
	L().Warn(msg, args...)
}

// Error logs at Error level.
func Error(msg string, args ...any) {
	L().Error(msg, args...)
}

// With returns a child logger with preset attributes.
func With(args ...any) *slog.Logger {
	return L().With(args...)
}

// WithGroup returns a child logger with group.
func WithGroup(name string) *slog.Logger {
	return L().WithGroup(name)
}
