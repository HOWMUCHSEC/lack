package main

import (
	"context"
	"lack-client/pkg/logger"
	"lack-client/pkg/utils"
	"net"
)

// SystemService 提供系统信息查询服务
type SystemService struct {
	ctx        context.Context
	cachedMACs []string // 启动时缓存的 MAC 地址
}

// NewSystemService 创建系统服务实例
func NewSystemService() *SystemService {
	return &SystemService{}
}

// Startup 初始化服务，注入 Wails 上下文，并预先获取 MAC 地址
func (s *SystemService) Startup(ctx context.Context) {
	s.ctx = ctx
	// 启动时获取并缓存 MAC 地址
	macs, err := s.fetchMACs()
	if err != nil {
		logger.Error("[DeviceGate] 启动时获取 MAC 失败", "error", err)
		s.cachedMACs = []string{}
	} else {
		s.cachedMACs = macs
		logger.Info("[DeviceGate] 启动时缓存 MAC", "macs", macs, "count", len(macs))
	}
}

// GetMACs 返回缓存的 MAC 地址列表
func (s *SystemService) GetMACs() ([]string, error) {
	return s.cachedMACs, nil
}

// fetchMACs 内部方法：获取本机所有有效网络接口的 MAC 地址（已去重和规范化）
func (s *SystemService) fetchMACs() ([]string, error) {
	ifs, err := net.Interfaces()
	if err != nil {
		return nil, err
	}

	// 使用 map 去重
	set := make(map[string]struct{})
	for _, iface := range ifs {
		if !utils.IsValidInterface(iface) {
			continue
		}
		normalized := utils.NormalizeMAC(iface.HardwareAddr.String())
		set[normalized] = struct{}{}
	}

	// 转为切片返回
	res := make([]string, 0, len(set))
	for mac := range set {
		res = append(res, mac)
	}
	return res, nil
}
