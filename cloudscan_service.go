package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"lack-client/pkg/cloudscan"
	"lack-client/pkg/logger"
	"lack-client/pkg/storage"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// AICloudSecurityService exposes cloud posture scanning to the frontend.
type AICloudSecurityService struct {
	ctx     context.Context
	scanner *cloudscan.Scanner
}

// NewAICloudSecurityService creates an AI cloud posture scanning service.
func NewAICloudSecurityService() *AICloudSecurityService {
	return &AICloudSecurityService{
		scanner: cloudscan.NewScanner(),
	}
}

// Startup stores the Wails context.
func (s *AICloudSecurityService) Startup(ctx context.Context) {
	s.ctx = ctx
}

func (s *AICloudSecurityService) shutdown() {
	if s.scanner == nil {
		return
	}
	if err := s.scanner.Close(); err != nil {
		logger.Error("清理 KICS 查询缓存失败", "error", err)
	}
}

// GetEngineStatus reports whether the embedded KICS engine is available.
func (s *AICloudSecurityService) GetEngineStatus() cloudscan.EngineStatus {
	return s.scanner.Status()
}

// SelectLocalRepository prompts the user to choose a local repository directory.
func (s *AICloudSecurityService) SelectLocalRepository() (string, error) {
	if s.ctx == nil {
		return "", fmt.Errorf("application context is not ready")
	}
	return runtime.OpenDirectoryDialog(s.ctx, runtime.OpenDialogOptions{
		Title: "Select local IaC repository",
	})
}

// Scan runs a cloud posture scan with the embedded KICS package.
func (s *AICloudSecurityService) Scan(req cloudscan.ScanRequest) (*cloudscan.ScanResult, error) {
	ctx := s.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var (
		result *cloudscan.ScanResult
		err    error
	)
	switch req.SourceType {
	case cloudscan.SourceTypeRepository:
		result, err = s.scanner.ScanRepository(ctx, req.Target)
	case cloudscan.SourceTypeLocalRepository:
		result, err = s.scanner.ScanLocalRepository(ctx, req.Target)
	case cloudscan.SourceTypeContent:
		result, err = s.scanner.ScanContent(ctx, req.Target, req.Content)
	default:
		return nil, fmt.Errorf("unsupported cloud scan source type: %s", req.SourceType)
	}
	if err != nil {
		return nil, err
	}
	if err := storeCloudScanResult(result); err != nil {
		logger.Warn("failed to store cloud scan result", "id", result.ID, "error", err)
	}
	return result, nil
}

func storeCloudScanResult(result *cloudscan.ScanResult) error {
	if result == nil {
		return nil
	}
	if result.ID == "" {
		result.ID = fmt.Sprintf("cloudscan-run-%d", time.Now().UnixNano())
	}
	if result.ScannedAt <= 0 {
		result.ScannedAt = time.Now().UnixMilli()
	}

	data, err := json.Marshal(result)
	if err != nil {
		return err
	}

	metaKey := fmt.Sprintf("cloudscan:run:%s:meta", result.ID)
	if err := storage.Put([]byte(metaKey), data); err != nil {
		return err
	}

	idxKey := fmt.Sprintf("cloudscan:runs:ts:%013d:%s", result.ScannedAt, result.ID)
	return storage.Put([]byte(idxKey), []byte(result.ID))
}
