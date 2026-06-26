package main

import (
	"context"
	"errors"
	"sync"

	"lack-client/pkg/nucleiscan"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// NucleiService 基础设施扫描服务（使用 nuclei）
type NucleiService struct {
	ctx         context.Context
	scanner     *nucleiscan.Scanner
	portMu      sync.Mutex
	portCancels map[string]context.CancelFunc
}

// NewNucleiService 创建 nuclei 扫描服务实例
func NewNucleiService() *NucleiService {
	return &NucleiService{
		scanner:     nucleiscan.NewScanner(),
		portCancels: make(map[string]context.CancelFunc),
	}
}

// Startup 初始化服务，注入 Wails 上下文
func (s *NucleiService) Startup(ctx context.Context) {
	s.ctx = ctx
	s.scanner.SetContext(ctx)
}

// ListTemplates 列出所有嵌入的模板
func (s *NucleiService) ListTemplates() ([]nucleiscan.TemplateInfo, error) {
	return nucleiscan.ListEmbeddedTemplates()
}

// StartScan 启动基础设施扫描任务
func (s *NucleiService) StartScan(cfg nucleiscan.ScanConfig) (string, error) {
	baseCtx := s.ctx
	if baseCtx == nil {
		baseCtx = context.Background()
	}

	runID, err := s.scanner.Start(baseCtx, cfg, nucleiscan.Callbacks{
		OnStarted: func(runID string, total int) {
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "nuclei:run:started", map[string]any{
					"runID":  runID,
					"taskID": cfg.TaskID,
					"total":  total,
				})
			}
		},
		OnFinding: func(event nucleiscan.FindingEvent) {
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "nuclei:run:finding", event)
			}
		},
		OnFinished: func(summary nucleiscan.ScanResult) {
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "nuclei:run:finished", summary)
			}
		},
	})

	return runID, err
}

// CancelScan 取消正在运行的扫描
func (s *NucleiService) CancelScan(runID string) error {
	return s.scanner.Cancel(runID)
}

// CancelPortScan cancels the port discovery phase for a scan task.
func (s *NucleiService) CancelPortScan(taskID string) error {
	if taskID == "" {
		return errors.New("taskID is required")
	}

	s.portMu.Lock()
	cancel := s.portCancels[taskID]
	delete(s.portCancels, taskID)
	s.portMu.Unlock()

	if cancel != nil {
		cancel()
	}
	return nil
}

// GetResult 获取扫描结果
func (s *NucleiService) GetResult(runID string) (*nucleiscan.ScanResult, error) {
	return s.scanner.GetResult(runID)
}

// ListRecentRuns 列出最近的扫描运行
func (s *NucleiService) ListRecentRuns(offset, limit int) ([]nucleiscan.ScanResult, error) {
	return s.scanner.ListRecentRuns(offset, limit)
}

// ScanPorts 执行端口扫描
func (s *NucleiService) ScanPorts(cfg nucleiscan.PortScanConfig) (*nucleiscan.PortScanResult, error) {
	baseCtx := s.ctx
	if baseCtx == nil {
		baseCtx = context.Background()
	}

	scanCtx, cancel := context.WithCancel(baseCtx)
	if cfg.TaskID != "" {
		s.portMu.Lock()
		if previous := s.portCancels[cfg.TaskID]; previous != nil {
			previous()
		}
		s.portCancels[cfg.TaskID] = cancel
		s.portMu.Unlock()
	}
	defer func() {
		cancel()
		if cfg.TaskID != "" {
			s.portMu.Lock()
			delete(s.portCancels, cfg.TaskID)
			s.portMu.Unlock()
		}
	}()

	return nucleiscan.ScanPorts(scanCtx, cfg, func(port nucleiscan.PortInfo) {
		if s.ctx != nil {
			runtime.EventsEmit(s.ctx, "nuclei:port:found", port)
		}
	})
}
