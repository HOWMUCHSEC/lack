package mcpserver

import (
	"encoding/json"
	"errors"
	"lack-client/pkg/logger"
	"net/http"
	"strings"
	"time"
)

// handleHealth responds to health check requests.
func (s *Service) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"ok":true}`))
}

// handleReport handles received MCP reports (compatible with old HTTP interface).
func (s *Service) handleReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !s.authenticateRequest(w, r) {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxReportBodyBytes)
	defer r.Body.Close()

	var payload struct {
		Agent  string     `json:"agent"`
		Issues []MCPIssue `json:"issues"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			w.WriteHeader(http.StatusRequestEntityTooLarge)
			_, _ = w.Write([]byte("request body too large"))
			return
		}
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte("invalid json"))
		return
	}

	id, meta, rep, err := s.storeReport(payload.Agent, payload.Issues)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("store error"))
		return
	}

	// Send event notification
	if s.ctx != nil {
		s.emitEvent("mcp:report:created", meta)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(struct {
		ID     string        `json:"id"`
		Meta   MCPReportMeta `json:"meta"`
		Report MCPReport     `json:"report"`
	}{ID: id, Meta: meta, Report: rep})
}

// WebSocket timeout configuration
const (
	wsWriteTimeout = 10 * time.Second
	wsReadTimeout  = 60 * time.Second
	wsPingInterval = 30 * time.Second
	wsPongTimeout  = 10 * time.Second
)

// handleWebSocket handles WebSocket connections.
func (s *Service) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	if !s.authenticateRequest(w, r) {
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Error("[MCP-WS] upgrade error", "error", err)
		return
	}
	s.registerWebSocket(conn)
	defer s.unregisterWebSocket(conn)
	defer conn.Close()
	conn.SetReadLimit(maxWSMessageBytes)

	logger.Info("[MCP-WS] client connected", "remote", r.RemoteAddr)
	s.emitEvent("mcp:ws:connected", map[string]string{"remote": r.RemoteAddr})

	// Set Pong handler, reset read deadline on pong
	conn.SetReadDeadline(time.Now().Add(wsReadTimeout))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(wsReadTimeout))
		return nil
	})

	// Start heartbeat goroutine
	done := make(chan struct{})
	go func() {
		ticker := time.NewTicker(wsPingInterval)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout))
				if err := conn.WriteMessage(9, nil); err != nil { // 9 = PingMessage
					logger.Warn("[MCP-WS] ping failed", "error", err)
					return
				}
			}
		}
	}()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			logger.Info("[MCP-WS] read error (may be normal close)", "error", err)
			break
		}

		// Reset read deadline on message
		conn.SetReadDeadline(time.Now().Add(wsReadTimeout))

		// Parse common message structure
		var msg ScanMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			logger.Warn("[MCP-WS] invalid json", "error", err)
			continue
		}

		// Dispatch based on message type
		switch msg.Type {
		case "start":
			s.handleScanStart(&msg)
		case "result":
			s.handleScanResult(&msg)
		case "complete":
			s.handleScanComplete(&msg)
		default:
			logger.Warn("[MCP-WS] unknown message type", "type", msg.Type)
		}
	}

	close(done) // Stop heartbeat goroutine
	logger.Info("[MCP-WS] client disconnected", "remote", r.RemoteAddr)
	s.emitEvent("mcp:ws:disconnected", map[string]string{"remote": r.RemoteAddr})
}

// handleScanStart handles scan start messages.
func (s *Service) handleScanStart(msg *ScanMessage) {
	logger.Info("[MCP-WS] scan started", "scanId", msg.ScanID, "scannerId", msg.ScannerID)

	// Parse data field
	var startData StartData
	if len(msg.Data) > 0 {
		if err := json.Unmarshal(msg.Data, &startData); err != nil {
			logger.Warn("[MCP-WS] invalid start data", "scanId", msg.ScanID, "error", err)
		}
	}

	// Create scan session
	session := &ScanSession{
		ID:         msg.ScanID,
		ScannerID:  msg.ScannerID,
		Status:     "running",
		Targets:    startData.Targets,
		TotalFiles: startData.TotalFiles,
		StartedAt:  time.Now().UnixMilli(),
		Results:    []ResultData{},
	}

	s.sessMu.Lock()
	s.sessions[msg.ScanID] = session
	s.sessMu.Unlock()

	// Send event to frontend
	s.emitEvent("mcp:scan:started", session)
}

// handleScanResult handles scan result messages.
func (s *Service) handleScanResult(msg *ScanMessage) {
	// Parse data field
	var result ResultData
	if err := json.Unmarshal(msg.Data, &result); err != nil {
		logger.Warn("[MCP-WS] invalid result data", "error", err)
		return
	}

	logger.Debug("[MCP-WS] result", "scanId", msg.ScanID, "rule", result.RuleID, "file", result.FilePath, "severity", result.Severity)

	s.sessMu.Lock()
	session, exists := s.sessions[msg.ScanID]
	if exists {
		session.Results = append(session.Results, result)
		session.ScannedFiles = msg.Meta.ScannedFiles
		session.TotalMatches = msg.Meta.TotalMatches

		// Update severity counts
		switch strings.ToLower(strings.TrimSpace(result.Severity)) {
		case "critical":
			session.Critical++
		case "high":
			session.High++
		case "medium":
			session.Medium++
		default:
			session.Low++
		}
	}
	s.sessMu.Unlock()

	// Send real-time result to frontend
	s.emitEvent("mcp:scan:result", map[string]interface{}{
		"scanId": msg.ScanID,
		"result": result,
		"meta":   msg.Meta,
	})
}

// handleScanComplete handles scan completion messages.
func (s *Service) handleScanComplete(msg *ScanMessage) {
	logger.Info("[MCP-WS] scan completed", "scanId", msg.ScanID)

	// Parse data field
	var completeData CompleteData
	if len(msg.Data) > 0 {
		if err := json.Unmarshal(msg.Data, &completeData); err != nil {
			logger.Warn("[MCP-WS] invalid complete data", "scanId", msg.ScanID, "error", err)
		}
	}

	s.sessMu.Lock()
	session, exists := s.sessions[msg.ScanID]
	if exists {
		session.Status = completeData.Status
		session.TotalFiles = completeData.TotalFiles
		session.ScannedFiles = completeData.ScannedFiles
		session.TotalMatches = completeData.TotalMatches
		session.CompletedAt = time.Now().UnixMilli()

		// Persist to storage
		go s.persistSession(session)

		// Remove from active sessions
		delete(s.sessions, msg.ScanID)
	}
	s.sessMu.Unlock()

	// Send completion event to frontend (only if session exists)
	if exists {
		s.emitEvent("mcp:scan:completed", session)
	}
}
