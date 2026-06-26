package mcpserver

import (
	"encoding/json"
	"errors"
	"net/url"
	"path/filepath"
	"testing"
	"time"

	"lack-client/pkg/storage"

	"github.com/gorilla/websocket"
)

func setupMCPTestStorage(t *testing.T) {
	t.Helper()

	if err := storage.Close(); err != nil {
		t.Fatalf("close existing db: %v", err)
	}

	root := t.TempDir()
	t.Setenv("HOME", root)
	t.Setenv("XDG_DATA_HOME", filepath.Join(root, "xdg"))
	t.Setenv("LOCALAPPDATA", filepath.Join(root, "localappdata"))

	if err := storage.OpenDefault(); err != nil {
		t.Fatalf("OpenDefault: %v", err)
	}

	t.Cleanup(func() {
		if err := storage.Close(); err != nil {
			t.Fatalf("close db: %v", err)
		}
	})
}

func TestStopLocalServerClosesActiveWebSockets(t *testing.T) {
	setupMCPTestStorage(t)

	svc := NewService()
	status, err := svc.StartLocalServer()
	if err != nil {
		t.Fatalf("StartLocalServer: %v", err)
	}
	t.Cleanup(func() {
		_ = svc.StopLocalServer()
	})

	endpoint, err := url.Parse(status.Endpoint)
	if err != nil {
		t.Fatalf("parse endpoint: %v", err)
	}
	query := endpoint.Query()
	query.Set("token", status.AuthToken)
	endpoint.RawQuery = query.Encode()

	conn, _, err := websocket.DefaultDialer.Dial(endpoint.String(), nil)
	if err != nil {
		t.Fatalf("dial websocket: %v", err)
	}
	defer conn.Close()

	waitForActiveWebSockets(t, svc, 1)

	readDone := make(chan error, 1)
	go func() {
		_, _, err := conn.ReadMessage()
		readDone <- err
	}()

	if err := svc.StopLocalServer(); err != nil {
		t.Fatalf("StopLocalServer: %v", err)
	}

	select {
	case err := <-readDone:
		if err == nil {
			t.Fatal("ReadMessage succeeded after StopLocalServer closed active websockets")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("websocket read did not unblock after StopLocalServer")
	}

	waitForActiveWebSockets(t, svc, 0)
}

func TestArchiveScanSessionUsesUniqueIndexKeysForTimestampCollision(t *testing.T) {
	setupMCPTestStorage(t)
	svc := NewService()
	ts := int64(1234567890)

	first := ScanSession{ID: "scan-a", ScannerID: "scanner", Status: "finished", CompletedAt: ts}
	second := ScanSession{ID: "scan-b", ScannerID: "scanner", Status: "finished", CompletedAt: ts}

	if err := svc.ArchiveScanSession(first); err != nil {
		t.Fatalf("ArchiveScanSession first: %v", err)
	}
	if err := svc.ArchiveScanSession(second); err != nil {
		t.Fatalf("ArchiveScanSession second: %v", err)
	}

	keys, err := storage.ListKeysByPrefix([]byte("mcp:scans:index:"), 0, 0)
	if err != nil {
		t.Fatalf("ListKeysByPrefix: %v", err)
	}
	if len(keys) != 2 {
		t.Fatalf("index key count = %d, want 2", len(keys))
	}

	sessions, err := svc.ListScanSessions(0, 10)
	if err != nil {
		t.Fatalf("ListScanSessions: %v", err)
	}
	if len(sessions) != 2 {
		t.Fatalf("session count = %d, want 2: %+v", len(sessions), sessions)
	}
}

func TestHandleScanResultTracksCriticalSeparately(t *testing.T) {
	svc := NewService()

	svc.handleScanStart(&ScanMessage{
		ScannerID: "scanner",
		ScanID:    "scan-critical",
		Data:      json.RawMessage(`{"targets":["."],"totalFiles":1}`),
	})
	svc.handleScanResult(&ScanMessage{
		ScanID: "scan-critical",
		Data:   json.RawMessage(`{"ruleId":"critical-rule","severity":"critical"}`),
		Meta:   ScanMeta{ScannedFiles: 1, TotalMatches: 1},
	})

	svc.sessMu.RLock()
	session := svc.sessions["scan-critical"]
	svc.sessMu.RUnlock()
	if session == nil {
		t.Fatal("session was not created")
	}
	if session.Critical != 1 {
		t.Fatalf("critical count = %d, want 1", session.Critical)
	}
	if session.High != 0 {
		t.Fatalf("high count = %d, want 0", session.High)
	}
}

func TestScanSessionUnmarshalDerivesCriticalForLegacyJSON(t *testing.T) {
	var session ScanSession
	if err := json.Unmarshal([]byte(`{
		"id": "legacy-critical",
		"scannerId": "scanner",
		"status": "finished",
		"targets": ["."],
		"totalFiles": 4,
		"scannedFiles": 4,
		"totalMatches": 4,
		"high": 2,
		"medium": 1,
		"low": 1,
		"startedAt": 1,
		"completedAt": 2,
		"results": [
			{"severity": "critical"},
			{"severity": "high"},
			{"severity": "medium"},
			{"severity": "low"}
		]
	}`), &session); err != nil {
		t.Fatalf("Unmarshal legacy ScanSession: %v", err)
	}

	if session.Critical != 1 {
		t.Fatalf("critical count = %d, want 1", session.Critical)
	}
	if session.High != 1 {
		t.Fatalf("high count = %d, want 1", session.High)
	}
	if session.Medium != 1 {
		t.Fatalf("medium count = %d, want 1", session.Medium)
	}
	if session.Low != 1 {
		t.Fatalf("low count = %d, want 1", session.Low)
	}
}

func TestListMCPReportsUsesUniqueIndexKeysForTimestampCollision(t *testing.T) {
	setupMCPTestStorage(t)
	svc := NewService()
	ts := int64(2234567890)

	for _, id := range []string{"report-a", "report-b"} {
		meta := MCPReportMeta{ID: id, CreatedAt: ts, Agent: "agent", Total: 1}
		report := MCPReport{Meta: meta, Issues: []MCPIssue{{Severity: "low", Rule: "rule"}}}
		if err := storage.Put([]byte("mcp:report:"+id+":meta"), mustJSON(meta)); err != nil {
			t.Fatalf("put report meta %s: %v", id, err)
		}
		if err := storage.Put([]byte("mcp:report:"+id+":data"), mustJSON(report)); err != nil {
			t.Fatalf("put report data %s: %v", id, err)
		}
		if err := storage.Put([]byte(mcpReportIndexKey(ts, id)), []byte(id)); err != nil {
			t.Fatalf("put report index %s: %v", id, err)
		}
	}

	reports, err := svc.ListMCPReports(0, 10)
	if err != nil {
		t.Fatalf("ListMCPReports: %v", err)
	}
	if len(reports) != 2 {
		t.Fatalf("report count = %d, want 2: %+v", len(reports), reports)
	}
}

func TestDeleteScanSessionPropagatesIndexDeleteError(t *testing.T) {
	setupMCPTestStorage(t)
	svc := NewService()
	session := ScanSession{ID: "scan-corrupt-index", ScannerID: "scanner", Status: "finished", CompletedAt: 42}

	if err := svc.ArchiveScanSession(session); err != nil {
		t.Fatalf("ArchiveScanSession: %v", err)
	}
	if err := storage.Delete([]byte(mcpScanIndexKey(session.CompletedAt, session.ID))); err != nil {
		t.Fatalf("delete index fixture: %v", err)
	}

	err := svc.DeleteScanSession(session.ID)
	if !errors.Is(err, storage.ErrKeyNotFound) {
		t.Fatalf("DeleteScanSession error = %v, want ErrKeyNotFound", err)
	}
}

func waitForActiveWebSockets(t *testing.T, svc *Service, want int) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		svc.wsMu.Lock()
		got := len(svc.wsConns)
		svc.wsMu.Unlock()
		if got == want {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	svc.wsMu.Lock()
	got := len(svc.wsConns)
	svc.wsMu.Unlock()
	t.Fatalf("active websocket count = %d, want %d", got, want)
}
