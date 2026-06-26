package evaluator

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"lack-client/pkg/logger"
)

const (
	supabaseURLEnv     = "SUPABASE_URL"
	supabaseAnonKeyEnv = "SUPABASE_ANON_KEY"
	maxErrorBodyBytes  = 4096
)

// 模板缓存
var (
	templateCache     map[string]*EvaluatorTemplate
	templateCacheMu   sync.RWMutex
	templateCacheTime time.Time
	cacheTTL          = 10 * time.Minute
)

// httpClient 复用的 HTTP 客户端
var httpClient = &http.Client{
	Timeout: 30 * time.Second,
}

func supabaseConfig() (baseURL, anonKey string, err error) {
	baseURL = strings.TrimRight(strings.TrimSpace(os.Getenv(supabaseURLEnv)), "/")
	anonKey = strings.TrimSpace(os.Getenv(supabaseAnonKeyEnv))
	if baseURL == "" || anonKey == "" {
		return "", "", fmt.Errorf("cloud evaluator templates are disabled: set %s and %s to enable Supabase-backed templates", supabaseURLEnv, supabaseAnonKeyEnv)
	}
	return baseURL, anonKey, nil
}

func readErrorBody(r io.Reader) string {
	body, _ := io.ReadAll(io.LimitReader(r, maxErrorBodyBytes))
	return string(body)
}

// FetchEvaluatorTemplates 从 Supabase 拉取所有活跃的评测器模板
func FetchEvaluatorTemplates() ([]EvaluatorTemplate, error) {
	baseURL, anonKey, err := supabaseConfig()
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf("%s/rest/v1/evaluator_templates?status=eq.active&order=evaluator_type.asc,version.desc", baseURL)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request error: %w", err)
	}

	req.Header.Set("apikey", anonKey)
	req.Header.Set("Authorization", "Bearer "+anonKey)
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("supabase error: status=%d body=%s", resp.StatusCode, readErrorBody(resp.Body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body error: %w", err)
	}

	var templates []EvaluatorTemplate
	if err := json.Unmarshal(body, &templates); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}

	logger.Info("FetchEvaluatorTemplates success", "count", len(templates))
	return templates, nil
}

// FetchEvaluatorTemplate 从 Supabase 拉取指定类型的最新评测器模板
func FetchEvaluatorTemplate(evaluatorType string) (*EvaluatorTemplate, error) {
	baseURL, anonKey, err := supabaseConfig()
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf(
		"%s/rest/v1/evaluator_templates?evaluator_type=eq.%s&status=eq.active&order=version.desc&limit=1",
		baseURL, url.QueryEscape(evaluatorType),
	)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request error: %w", err)
	}

	req.Header.Set("apikey", anonKey)
	req.Header.Set("Authorization", "Bearer "+anonKey)
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("supabase error: status=%d body=%s", resp.StatusCode, readErrorBody(resp.Body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body error: %w", err)
	}

	var templates []EvaluatorTemplate
	if err := json.Unmarshal(body, &templates); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}

	if len(templates) == 0 {
		return nil, fmt.Errorf("evaluator template not found: %s", evaluatorType)
	}

	logger.Info("FetchEvaluatorTemplate success", "type", evaluatorType, "version", templates[0].Version)
	return &templates[0], nil
}

// GetCachedTemplate 获取缓存的模板，如果缓存过期则重新拉取
func GetCachedTemplate(evaluatorType string) (*EvaluatorTemplate, error) {
	templateCacheMu.RLock()
	if templateCache != nil && time.Since(templateCacheTime) < cacheTTL {
		if t, ok := templateCache[evaluatorType]; ok {
			templateCacheMu.RUnlock()
			return t, nil
		}
	}
	templateCacheMu.RUnlock()

	// 缓存过期或不存在，重新拉取
	return RefreshAndGetTemplate(evaluatorType)
}

// RefreshAndGetTemplate 强制刷新缓存并获取模板
func RefreshAndGetTemplate(evaluatorType string) (*EvaluatorTemplate, error) {
	templates, err := FetchEvaluatorTemplates()
	if err != nil {
		return nil, err
	}

	templateCacheMu.Lock()
	defer templateCacheMu.Unlock()

	templateCache = make(map[string]*EvaluatorTemplate)
	for i := range templates {
		t := &templates[i]
		// 只保留每个类型的第一个（最新版本）
		if _, exists := templateCache[t.EvaluatorType]; !exists {
			templateCache[t.EvaluatorType] = t
		}
	}
	templateCacheTime = time.Now()

	if t, ok := templateCache[evaluatorType]; ok {
		return t, nil
	}
	return nil, fmt.Errorf("evaluator template not found: %s", evaluatorType)
}

// ListCachedTemplates 获取所有缓存的模板列表
func ListCachedTemplates() ([]EvaluatorInfo, error) {
	templateCacheMu.RLock()
	cacheValid := templateCache != nil && time.Since(templateCacheTime) < cacheTTL
	templateCacheMu.RUnlock()

	if !cacheValid {
		// 刷新缓存
		templates, err := FetchEvaluatorTemplates()
		if err != nil {
			return nil, err
		}

		templateCacheMu.Lock()
		templateCache = make(map[string]*EvaluatorTemplate)
		for i := range templates {
			t := &templates[i]
			if _, exists := templateCache[t.EvaluatorType]; !exists {
				templateCache[t.EvaluatorType] = t
			}
		}
		templateCacheTime = time.Now()
		templateCacheMu.Unlock()
	}

	templateCacheMu.RLock()
	defer templateCacheMu.RUnlock()

	result := make([]EvaluatorInfo, 0, len(templateCache))
	for _, t := range templateCache {
		result = append(result, EvaluatorInfo{
			EvaluatorType:     t.EvaluatorType,
			Name:              t.Name,
			NameZh:            t.NameZh,
			Description:       t.Description,
			DescriptionZh:     t.DescriptionZh,
			Version:           t.Version,
			SupportedDatasets: t.SupportedDatasets,
			MinPlan:           t.MinPlan,
		})
	}

	return result, nil
}

// ClearTemplateCache 清除模板缓存
func ClearTemplateCache() {
	templateCacheMu.Lock()
	defer templateCacheMu.Unlock()
	templateCache = nil
	templateCacheTime = time.Time{}
	logger.Info("Evaluator template cache cleared")
}
