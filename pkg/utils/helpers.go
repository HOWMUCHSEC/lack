package utils

import (
	"bytes"
	"context"
	"encoding/json"
	"net"
	"regexp"
	"strings"
	"sync"
)

// jsonBufferPool reuses JSON serialization buffer.
var jsonBufferPool = sync.Pool{
	New: func() any {
		return new(bytes.Buffer)
	},
}

// PlaceholderRe regex for placeholders (precompiled for performance).
var PlaceholderRe = regexp.MustCompile(`\{\{([a-zA-Z0-9_\-]+)\}\}`)

// Interpolate replaces {{placeholder}} in text with variable values.
func Interpolate(text string, vars map[string]string) string {
	if text == "" || len(vars) == 0 {
		return text
	}
	return PlaceholderRe.ReplaceAllStringFunc(text, func(m string) string {
		sub := PlaceholderRe.FindStringSubmatch(m)
		if len(sub) != 2 {
			return m
		}
		if v, ok := vars[sub[1]]; ok {
			return v
		}
		return "" // Replace with empty string if missing
	})
}

// ExtractPlaceholders extracts all placeholder variable names from text.
func ExtractPlaceholders(content string) []string {
	matches := PlaceholderRe.FindAllStringSubmatch(content, -1)
	seen := make(map[string]bool)
	result := make([]string, 0)
	for _, m := range matches {
		if len(m) >= 2 && !seen[m[1]] {
			seen[m[1]] = true
			result = append(result, m[1])
		}
	}
	return result
}

// NormalizeMAC normalizes MAC address format (lowercase and remove separators).
func NormalizeMAC(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') {
			b.WriteByte(c)
		}
	}
	return b.String()
}

// IsZeroMAC checks if MAC address is all zeros.
func IsZeroMAC(norm string) bool {
	if norm == "" {
		return true
	}
	for i := 0; i < len(norm); i++ {
		if norm[i] != '0' {
			return false
		}
	}
	return true
}

// ShouldSkipInterface checks if network interface should be skipped.
func ShouldSkipInterface(name string) bool {
	name = strings.ToLower(name)
	prefixes := []string{"lo", "docker", "veth", "br-", "awdl", "llw", "utun", "gif", "stf", "bridge", "vmnet", "p2p"}
	for _, p := range prefixes {
		if strings.HasPrefix(name, p) {
			return true
		}
	}
	return false
}

// SanitizeUserID sanitizes user ID, keeping only alphanumeric, underscore and hyphen.
func SanitizeUserID(s string) string {
	if s == "" {
		return "anon"
	}
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	return b.String()
}

// IsValidInterface checks if network interface is valid (up, not loopback, non-zero MAC).
func IsValidInterface(iface net.Interface) bool {
	if (iface.Flags&net.FlagUp) == 0 {
		return false
	}
	if (iface.Flags&net.FlagLoopback) != 0 {
		return false
	}
	if ShouldSkipInterface(iface.Name) {
		return false
	}
	hw := iface.HardwareAddr.String()
	if hw == "" {
		return false
	}
	n := NormalizeMAC(hw)
	if n == "" || IsZeroMAC(n) {
		return false
	}
	return true
}

// MustJSON serializes object to JSON, ignoring errors (uses buffer pool).
func MustJSON(v any) []byte {
	buf := jsonBufferPool.Get().(*bytes.Buffer)
	buf.Reset()
	defer jsonBufferPool.Put(buf)

	enc := json.NewEncoder(buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil
	}
	// Encode appends newline, remove it
	b := buf.Bytes()
	if len(b) > 0 && b[len(b)-1] == '\n' {
		b = b[:len(b)-1]
	}
	// Return copy to avoid data corruption after buffer reuse
	result := make([]byte, len(b))
	copy(result, b)
	return result
}

// EnsureContext ensures context is not nil, returns context.Background() if nil.
func EnsureContext(ctx context.Context) context.Context {
	if ctx == nil {
		return context.Background()
	}
	return ctx
}

// Paginate generic pagination function, returns start and end indices.
// Returns (start, end), caller uses items[start:end]
func Paginate(total, offset, limit int) (start, end int) {
	if offset < 0 {
		offset = 0
	}
	if offset >= total {
		return total, total
	}
	start = offset
	end = total
	if limit > 0 && start+limit < end {
		end = start + limit
	}
	return start, end
}

// ArrayIndexRe precompiled array index regex.
var ArrayIndexRe = regexp.MustCompile(`\[(\d+)\]`)
