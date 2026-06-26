package mcpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"lack-client/pkg/logger"
	"lack-client/pkg/storage"
	"lack-client/pkg/utils"

	"github.com/getsentry/sentry-go"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// WebSocket upgrader configuration
var upgrader = websocket.Upgrader{
	CheckOrigin: isAllowedOrigin,
}

// defaultService instance for global access
var defaultService *Service

// Service manages the local MCP server.
type Service struct {
	ctx            context.Context         // Wails context
	mu             sync.Mutex              // Concurrency lock
	srv            *http.Server            // HTTP server instance
	ln             net.Listener            // Network listener
	status         LocalServerStatus       // Server status
	authTokenValue atomic.Value            // Current bearer token, stored as string
	sessions       map[string]*ScanSession // Active scan sessions (scanId -> session)
	sessMu         sync.RWMutex            // Session concurrency lock
	wsMu           sync.Mutex              // Active WebSocket connection lock
	wsConns        map[*websocket.Conn]struct{}
}

// NewService creates a new MCP server service instance.
func NewService() *Service {
	s := &Service{
		sessions: make(map[string]*ScanSession),
		wsConns:  make(map[*websocket.Conn]struct{}),
	}
	defaultService = s
	return s
}

// Shutdown closes the default local server instance (called on app shutdown).
func Shutdown() error {
	if defaultService != nil {
		return defaultService.StopLocalServer()
	}
	return nil
}

// IsRunning checks if the default local server instance is running.
func IsRunning() bool {
	if defaultService == nil {
		return false
	}
	defaultService.mu.Lock()
	defer defaultService.mu.Unlock()
	return defaultService.srv != nil && defaultService.ln != nil
}

// Startup initializes the service with the Wails context.
func (s *Service) Startup(ctx context.Context) {
	s.ctx = ctx
}

// StartLocalServer starts the local MCP server on a random port.
func (s *Service) StartLocalServer() (LocalServerStatus, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.srv != nil && s.ln != nil {
		return s.status, nil
	}

	_ = storage.OpenDefault()

	authToken, err := generateAuthToken()
	if err != nil {
		return LocalServerStatus{}, err
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/health", s.handleHealth)
	mux.HandleFunc("/v1/report", s.handleReport)
	mux.HandleFunc("/v1/ws", s.handleWebSocket) // WebSocket endpoint

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return LocalServerStatus{}, err
	}

	port := ln.Addr().(*net.TCPAddr).Port
	endpoint := fmt.Sprintf("ws://127.0.0.1:%d/v1/ws", port)

	srv := &http.Server{
		Handler:           loggingMiddleware(mwCORS(mux)),
		ReadHeaderTimeout: 5 * time.Second,
	}
	s.srv = srv
	s.ln = ln
	s.status = LocalServerStatus{
		Running:   true,
		Endpoint:  endpoint,
		AuthToken: authToken,
		Port:      port,
		StartedAt: time.Now().UnixMilli(),
	}
	s.authTokenValue.Store(authToken)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("MCP server goroutine panic recovered", "error", r)
				sentry.CurrentHub().Recover(r)
			}
		}()
		_ = srv.Serve(ln)
	}()

	if s.ctx != nil {
		s.emitEvent("mcp:server:started", s.status)
	}

	if err := storage.Put([]byte("mcp:server:status"), mustJSON(statusForStorage(s.status))); err != nil {
		logger.Warn("failed to persist server status", "error", err)
	}
	return s.status, nil
}

// StopLocalServer stops the local MCP server.
func (s *Service) StopLocalServer() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.srv == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	s.closeActiveWebSockets()

	if err := s.srv.Shutdown(ctx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Warn("failed to shutdown MCP server", "error", err)
	}
	s.srv = nil

	if s.ln != nil {
		_ = s.ln.Close()
		s.ln = nil
	}

	s.status = LocalServerStatus{}
	s.authTokenValue.Store("")

	if s.ctx != nil {
		s.emitEvent("mcp:server:stopped", nil)
	}

	if err := storage.Put([]byte("mcp:server:status"), mustJSON(s.status)); err != nil {
		logger.Warn("failed to persist server status on stop", "error", err)
	}
	return nil
}

func (s *Service) registerWebSocket(conn *websocket.Conn) {
	s.wsMu.Lock()
	defer s.wsMu.Unlock()
	if s.wsConns == nil {
		s.wsConns = make(map[*websocket.Conn]struct{})
	}
	s.wsConns[conn] = struct{}{}
}

func (s *Service) unregisterWebSocket(conn *websocket.Conn) {
	s.wsMu.Lock()
	defer s.wsMu.Unlock()
	delete(s.wsConns, conn)
}

func (s *Service) closeActiveWebSockets() {
	s.wsMu.Lock()
	conns := make([]*websocket.Conn, 0, len(s.wsConns))
	for conn := range s.wsConns {
		conns = append(conns, conn)
	}
	s.wsMu.Unlock()

	for _, conn := range conns {
		_ = conn.Close()
	}
}

// GetLocalServerStatus returns the current server status.
func (s *Service) GetLocalServerStatus() (LocalServerStatus, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.srv != nil && s.ln != nil {
		return s.status, nil
	}

	b, err := storage.Get([]byte("mcp:server:status"))
	if err != nil || len(b) == 0 {
		return LocalServerStatus{Running: false}, nil
	}

	var st LocalServerStatus
	if json.Unmarshal(b, &st) == nil {
		if st.Running {
			return LocalServerStatus{Running: false}, nil
		}
		return st, nil
	}

	return LocalServerStatus{Running: false}, nil
}

// ListMCPReports returns a paginated list of MCP report metadata.
func (s *Service) ListMCPReports(offset, limit int) ([]MCPReportMeta, error) {
	prefix := []byte("mcp:reports:index:")
	items, err := storage.ListByPrefix(prefix, 0, 0)
	if err != nil {
		return nil, err
	}

	type pair struct {
		ts int64
		id string
	}

	pairs := make([]pair, 0, len(items))
	for _, it := range items {
		ts, id := parseMCPIndexItem(it.Key, it.Value, "mcp:reports:index:")
		if ts == 0 || id == "" {
			continue
		}
		pairs = append(pairs, pair{ts: ts, id: id})
	}

	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].ts == pairs[j].ts {
			return pairs[i].id > pairs[j].id
		}
		return pairs[i].ts > pairs[j].ts
	})

	start, end := utils.Paginate(len(pairs), offset, limit)
	pairs = pairs[start:end]

	res := make([]MCPReportMeta, 0, len(pairs))
	for _, p := range pairs {
		b, err := storage.Get([]byte(fmt.Sprintf("mcp:report:%s:meta", p.id)))
		if err != nil || len(b) == 0 {
			continue
		}
		var meta MCPReportMeta
		if json.Unmarshal(b, &meta) == nil {
			res = append(res, meta)
		}
	}

	return res, nil
}

// GetMCPReport retrieves a specific MCP report by ID.
func (s *Service) GetMCPReport(id string) (MCPReport, error) {
	if id == "" {
		return MCPReport{}, errors.New("id 为必填")
	}

	b, err := storage.Get([]byte(fmt.Sprintf("mcp:report:%s:data", id)))
	if err != nil {
		return MCPReport{}, err
	}

	var rep MCPReport
	if err := json.Unmarshal(b, &rep); err != nil {
		return MCPReport{}, err
	}

	return rep, nil
}

// storeReport saves an MCP report to storage.
func (s *Service) storeReport(agent string, issues []MCPIssue) (string, MCPReportMeta, MCPReport, error) {
	id := uuid.NewString()
	ts := time.Now().UnixMilli()

	h, m, l := 0, 0, 0
	for _, is := range issues {
		sw := strings.ToLower(strings.TrimSpace(is.Severity))
		if sw == "high" || sw == "critical" {
			h++
		} else if sw == "medium" {
			m++
		} else {
			l++
		}
	}

	meta := MCPReportMeta{
		ID:        id,
		CreatedAt: ts,
		Agent:     agent,
		Total:     len(issues),
		High:      h,
		Medium:    m,
		Low:       l,
	}

	rep := MCPReport{Meta: meta, Issues: issues}

	if err := storage.Put([]byte(fmt.Sprintf("mcp:report:%s:meta", id)), mustJSON(meta)); err != nil {
		return "", MCPReportMeta{}, MCPReport{}, err
	}
	if err := storage.Put([]byte(fmt.Sprintf("mcp:report:%s:data", id)), mustJSON(rep)); err != nil {
		return "", MCPReportMeta{}, MCPReport{}, err
	}
	if err := storage.Put([]byte(mcpReportIndexKey(ts, id)), []byte(id)); err != nil {
		return "", MCPReportMeta{}, MCPReport{}, err
	}

	return id, meta, rep, nil
}

// persistSession persists a scan session to storage.
func (s *Service) persistSession(session *ScanSession) {
	if session == nil {
		return
	}

	// Store complete session data
	if err := storage.Put([]byte(fmt.Sprintf("mcp:scan:%s:data", session.ID)), mustJSON(session)); err != nil {
		return
	}

	// Store index (by completion time)
	_ = storage.Put([]byte(mcpScanIndexKey(session.CompletedAt, session.ID)), []byte(session.ID))
}

// ListScanSessions returns a paginated list of scan sessions.
func (s *Service) ListScanSessions(offset, limit int) ([]ScanSession, error) {
	prefix := []byte("mcp:scans:index:")
	items, err := storage.ListByPrefix(prefix, 0, 0)
	if err != nil {
		return nil, err
	}

	type pair struct {
		ts int64
		id string
	}

	pairs := make([]pair, 0, len(items))
	for _, it := range items {
		ts, id := parseMCPIndexItem(it.Key, it.Value, "mcp:scans:index:")
		if ts == 0 || id == "" {
			continue
		}
		pairs = append(pairs, pair{ts: ts, id: id})
	}

	// Sort by time descending
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].ts == pairs[j].ts {
			return pairs[i].id > pairs[j].id
		}
		return pairs[i].ts > pairs[j].ts
	})

	start, end := utils.Paginate(len(pairs), offset, limit)
	pairs = pairs[start:end]

	res := make([]ScanSession, 0, len(pairs))
	for _, p := range pairs {
		b, err := storage.Get([]byte(fmt.Sprintf("mcp:scan:%s:data", p.id)))
		if err != nil || len(b) == 0 {
			continue
		}
		var sess ScanSession
		if json.Unmarshal(b, &sess) == nil {
			res = append(res, sess)
		}
	}

	return res, nil
}

// GetScanSession retrieves a specific scan session by ID.
func (s *Service) GetScanSession(id string) (ScanSession, error) {
	if id == "" {
		return ScanSession{}, errors.New("id 为必填")
	}

	b, err := storage.Get([]byte(fmt.Sprintf("mcp:scan:%s:data", id)))
	if err != nil {
		return ScanSession{}, err
	}

	var sess ScanSession
	if err := json.Unmarshal(b, &sess); err != nil {
		return ScanSession{}, err
	}

	return sess, nil
}

// DeleteScanSession deletes a specific scan session.
func (s *Service) DeleteScanSession(id string) error {
	if id == "" {
		return errors.New("id 为必填")
	}

	// 获取会话以找到索引时间戳
	sess, err := s.GetScanSession(id)
	if err != nil {
		return err
	}

	dataPrefix := []byte(fmt.Sprintf("mcp:scan:%s:", id))
	var errs []error
	if _, err := storage.DeleteByPrefix(dataPrefix); err != nil {
		errs = append(errs, err)
	}
	if err := deleteMCPScanIndex(sess.CompletedAt, id); err != nil {
		errs = append(errs, err)
	}
	return errors.Join(errs...)
}

// ArchiveScanSession archives a scan session to history.
func (s *Service) ArchiveScanSession(sess ScanSession) error {
	if sess.ID == "" {
		return errors.New("session ID 为必填")
	}

	// 保存扫描数据
	dataKey := fmt.Sprintf("mcp:scan:%s:data", sess.ID)
	if err := storage.Put([]byte(dataKey), mustJSON(sess)); err != nil {
		return err
	}

	// 创建索引
	indexKey := mcpScanIndexKey(sess.CompletedAt, sess.ID)
	if err := storage.Put([]byte(indexKey), []byte(sess.ID)); err != nil {
		return err
	}

	logger.Info("[MCP] archived scan session", "sessionID", sess.ID)
	return nil
}

// emitEvent emits a runtime event if context is available.
func (s *Service) emitEvent(eventName string, data interface{}) {
	if s.ctx != nil {
		runtime.EventsEmit(s.ctx, eventName, data)
	}
}

// mustJSON marshals value to JSON, ignoring errors.
func mustJSON(v any) []byte {
	return utils.MustJSON(v)
}

func mcpReportIndexKey(ts int64, id string) string {
	return fmt.Sprintf("mcp:reports:index:%d:%s", ts, id)
}

func mcpScanIndexKey(ts int64, id string) string {
	return fmt.Sprintf("mcp:scans:index:%d:%s", ts, id)
}

func parseMCPIndexItem(key, value []byte, prefix string) (int64, string) {
	suffix := strings.TrimPrefix(string(key), prefix)
	parts := strings.SplitN(suffix, ":", 2)
	var ts int64
	if _, err := fmt.Sscanf(parts[0], "%d", &ts); err != nil {
		return 0, ""
	}
	if len(parts) == 2 && parts[1] != "" {
		return ts, parts[1]
	}
	return ts, string(value)
}

func deleteMCPScanIndex(ts int64, id string) error {
	key := mcpScanIndexKey(ts, id)
	exists, err := storageKeyExists(key)
	if err != nil {
		return err
	}
	if exists {
		return storage.Delete([]byte(key))
	}

	legacyKey := fmt.Sprintf("mcp:scans:index:%d", ts)
	exists, err = storageKeyExists(legacyKey)
	if err != nil {
		return err
	}
	if !exists {
		return storage.ErrKeyNotFound
	}
	return storage.Delete([]byte(legacyKey))
}

func storageKeyExists(key string) (bool, error) {
	keys, err := storage.ListKeysByPrefix([]byte(key), 0, 0)
	if err != nil {
		return false, err
	}
	for _, candidate := range keys {
		if string(candidate) == key {
			return true, nil
		}
	}
	return false, nil
}
