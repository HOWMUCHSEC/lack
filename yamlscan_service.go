package main

import (
	"lack-client/pkg/yamlscan"
)

// YamlScanService YAML 安全扫描服务（Wails 绑定）
type YamlScanService struct{}

// NewYamlScanService 创建 YAML 扫描服务实例
func NewYamlScanService() *YamlScanService {
	return &YamlScanService{}
}

// FetchFromGitHub 从 GitHub URL 获取文件内容
func (s *YamlScanService) FetchFromGitHub(url string) (string, error) {
	return yamlscan.FetchFromGitHub(url)
}

// ScanYAML 扫描 YAML 内容
func (s *YamlScanService) ScanYAML(req yamlscan.ScanRequest) (yamlscan.ScanResult, error) {
	return yamlscan.ScanYAML(req)
}

// GetResult 获取扫描结果
func (s *YamlScanService) GetResult(id string) (*yamlscan.ScanResult, error) {
	return yamlscan.GetResult(id)
}

// ListHistory 获取扫描历史列表
func (s *YamlScanService) ListHistory(offset, limit int) ([]yamlscan.ScanHistory, int, error) {
	return yamlscan.ListHistory(offset, limit)
}

// DeleteHistory 删除扫描历史
func (s *YamlScanService) DeleteHistory(id string) error {
	return yamlscan.DeleteHistory(id)
}

// ClearHistory 清空所有扫描历史
func (s *YamlScanService) ClearHistory() error {
	return yamlscan.ClearHistory()
}

// GetBuiltinRules 获取内置规则列表
func (s *YamlScanService) GetBuiltinRules() []yamlscan.Rule {
	return yamlscan.GetBuiltinRules()
}
