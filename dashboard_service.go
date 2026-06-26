package main

import (
	"context"
	"encoding/json"
	"fmt"
	"lack-client/pkg/evaluator"
	"lack-client/pkg/scanner"
	"lack-client/pkg/storage"
	"sort"
	"sync"
	"time"
)

// DashboardService provides dashboard data aggregation services.
type DashboardService struct {
	ctx   context.Context
	mu    sync.RWMutex
	cache map[string]cacheEntry
}

// cacheEntry holds cached data with expiration time.
type cacheEntry struct {
	data      interface{}
	expiresAt time.Time
}

const dashboardCacheTTL = 30 * time.Second

// maxListLimit is the safety upper bound for ListByPrefix full-scan queries
// to prevent excessive memory usage when data volume grows.
const maxListLimit = 10000

// NewDashboardService creates a new DashboardService instance.
func NewDashboardService() *DashboardService {
	return &DashboardService{
		cache: make(map[string]cacheEntry),
	}
}

// Startup is called at application startup
func (s *DashboardService) Startup(ctx context.Context) {
	s.ctx = ctx
}

// getCache retrieves a cached value if it exists and is not expired.
func (s *DashboardService) getCache(key string) (interface{}, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entry, ok := s.cache[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.data, true
}

// setCache stores a value in the cache with TTL.
func (s *DashboardService) setCache(key string, data interface{}) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cache[key] = cacheEntry{
		data:      data,
		expiresAt: time.Now().Add(dashboardCacheTTL),
	}
}

// TaskTrendItem represents a single data point in the task execution trend.
type TaskTrendItem struct {
	Date  string `json:"date"`  // Date label (e.g., "12/25" or "Mon")
	Tasks int    `json:"tasks"` // Tasks count per day
}

// RiskDistItem represents risk distribution statistics.
type RiskDistItem struct {
	High   int `json:"high"`   // High risk count
	Medium int `json:"medium"` // Medium risk count
	Low    int `json:"low"`    // Low risk count
}

// GetTaskTrend returns task execution trends for the last N days.
func (s *DashboardService) GetTaskTrend(days int) ([]TaskTrendItem, error) {
	if days <= 0 {
		days = 30
	}

	now := time.Now()
	// Calculate start time (N days ago at 00:00:00)
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	startTime := startOfToday.AddDate(0, 0, -days+1)

	// Initialize daily counters
	dailyCounts := make(map[string]int)
	dateLabels := make([]string, days)
	for i := 0; i < days; i++ {
		d := startTime.AddDate(0, 0, i)
		key := d.Format("2006-01-02")
		dailyCounts[key] = 0
		dateLabels[i] = key
	}

	// Count evaluation tasks
	evalTasks, _, err := evaluator.ListTasks("", 0, 0)
	if err == nil {
		for _, task := range evalTasks {
			if task.CreatedAt > 0 {
				t := time.UnixMilli(task.CreatedAt)
				if t.After(startTime) || t.Equal(startTime) {
					key := t.Format("2006-01-02")
					if _, ok := dailyCounts[key]; ok {
						dailyCounts[key]++
					}
				}
			}
		}
	}

	// Count scan tasks (iterate through global timestamp index)
	scanItems, err := storage.ListByPrefix([]byte("scan:runs:ts:"), 0, maxListLimit)
	if err == nil {
		for _, item := range scanItems {
			runID := string(item.Value)
			metaKey := "scan:run:" + runID + ":meta"
			b, err := storage.Get([]byte(metaKey))
			if err != nil {
				continue
			}
			var rr scanner.RunResult
			if json.Unmarshal(b, &rr) == nil && rr.StartedAt > 0 {
				t := time.UnixMilli(rr.StartedAt)
				if t.After(startTime) || t.Equal(startTime) {
					key := t.Format("2006-01-02")
					if _, ok := dailyCounts[key]; ok {
						dailyCounts[key]++
					}
				}
			}
		}
	}

	// Build results (sorted by date)
	result := make([]TaskTrendItem, 0, days)
	for _, dateKey := range dateLabels {
		d, _ := time.Parse("2006-01-02", dateKey)
		// 格式化为 "M/D" 格式
		label := d.Format("1/2")
		result = append(result, TaskTrendItem{
			Date:  label,
			Tasks: dailyCounts[dateKey],
		})
	}

	return result, nil
}

// GetRiskDistribution returns current risk distribution statistics.
func (s *DashboardService) GetRiskDistribution() (*RiskDistItem, error) {
	// Check cache first
	if cached, ok := s.getCache("riskDist"); ok {
		return cached.(*RiskDistItem), nil
	}

	result := &RiskDistItem{}

	// 统计评测任务的风险分布
	evalTasks, _, err := evaluator.ListTasks("", 0, 0)
	if err == nil {
		for _, task := range evalTasks {
			if task.Status != evaluator.TaskStatusCompleted {
				continue
			}
			// 获取任务的测试条目统计
			items, _, err := evaluator.ListTestItems(task.ID, 0, 0)
			if err != nil {
				continue
			}

			var passed, total int
			for _, item := range items {
				if item.Status == evaluator.ItemStatusCompleted {
					total++
					if item.EvalResult != nil && item.EvalResult.Label == "pass" {
						passed++
					}
				}
			}

			if total > 0 {
				passRate := float64(passed) / float64(total) * 100
				switch {
				case passRate < 70:
					result.High++
				case passRate < 90:
					result.Medium++
				default:
					result.Low++
				}
			}
		}
	}

	// 统计扫描任务的风险分布
	scanItems, err := storage.ListByPrefix([]byte("scan:runs:ts:"), 0, maxListLimit)
	if err == nil {
		for _, item := range scanItems {
			runID := string(item.Value)
			metaKey := "scan:run:" + runID + ":meta"
			b, err := storage.Get([]byte(metaKey))
			if err != nil {
				continue
			}
			var rr scanner.RunResult
			if json.Unmarshal(b, &rr) == nil && rr.Total > 0 {
				passRate := float64(rr.Ok) / float64(rr.Total) * 100
				switch {
				case passRate < 70:
					result.High++
				case passRate < 90:
					result.Medium++
				default:
					result.Low++
				}
			}
		}
	}

	securityStats := aggregateSecurityStats()
	addSecurityRiskDistribution(result, securityStats.MCP)
	addSecurityRiskDistribution(result, securityStats.Infra)
	addSecurityRiskDistribution(result, securityStats.Cloud)

	// Cache the result
	s.setCache("riskDist", result)
	return result, nil
}

func addSecurityRiskDistribution(result *RiskDistItem, item SecurityItem) {
	if result == nil {
		return
	}
	total := item.Findings + item.Vulnerabilities + item.Threats + item.Critical
	if total == 0 {
		return
	}
	switch item.Status {
	case "danger":
		result.High++
	case "warning":
		result.Medium++
	default:
		result.Low++
	}
}

// DashboardStats holds aggregated dashboard statistics.
type DashboardStats struct {
	TotalProjects  int `json:"totalProjects"`  // Total projects
	TotalTasks     int `json:"totalTasks"`     // Total tasks
	RunningTasks   int `json:"runningTasks"`   // Running tasks
	CompletedToday int `json:"completedToday"` // Completed today
	HighRiskCount  int `json:"highRiskCount"`  // High risk count
}

// GetDashboardStats returns aggregated dashboard statistics.
func (s *DashboardService) GetDashboardStats() (*DashboardStats, error) {
	stats := &DashboardStats{}

	// 统计评测项目
	projects, total, err := evaluator.ListProjects(0, 0)
	if err == nil {
		stats.TotalProjects = total
		_ = projects
	}

	// 统计评测任务
	evalTasks, evalTotal, err := evaluator.ListTasks("", 0, 0)
	if err == nil {
		stats.TotalTasks += evalTotal

		// 今日开始时间
		now := time.Now()
		startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).UnixMilli()

		for _, task := range evalTasks {
			if task.Status == evaluator.TaskStatusRunning {
				stats.RunningTasks++
			}
			if task.Status == evaluator.TaskStatusCompleted && task.UpdatedAt >= startOfToday {
				stats.CompletedToday++
			}
		}
	}

	// 统计扫描任务
	activeCount, _ := storage.CountByPrefix([]byte("scan:run:active:"))
	stats.RunningTasks += activeCount

	// 获取风险分布用于高风险计数
	riskDist, err := s.GetRiskDistribution()
	if err == nil {
		stats.HighRiskCount = riskDist.High
	}

	return stats, nil
}

// RecentTaskItem represents a summary item for a recent task.
type RecentTaskItem struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Type        string  `json:"type"` // "eval" or "scan"
	Status      string  `json:"status"`
	Progress    int     `json:"progress"`    // Progress percentage
	Total       int     `json:"total"`       // Total items
	Completed   int     `json:"completed"`   // Completed items
	PassRate    float64 `json:"passRate"`    // Pass rate
	ExecutedAt  int64   `json:"executedAt"`  // Timestamp
	ProjectName string  `json:"projectName"` // Project name
}

// GetRecentTasks returns a list of recently executed tasks.
func (s *DashboardService) GetRecentTasks(limit int) ([]RecentTaskItem, error) {
	if limit <= 0 {
		limit = 10
	}

	// Check cache first (cache key includes limit)
	cacheKey := fmt.Sprintf("recentTasks:%d", limit)
	if cached, ok := s.getCache(cacheKey); ok {
		return cached.([]RecentTaskItem), nil
	}

	var items []RecentTaskItem

	// 获取评测任务
	evalTasks, _, err := evaluator.ListTasks("", 0, 0)
	if err == nil {
		for _, task := range evalTasks {
			// 获取项目名称
			projectName := ""
			if project, err := evaluator.GetProject(task.ProjectID); err == nil {
				projectName = project.Name
			}

			// 计算进度和通过率
			var progress, completed, passed int
			testItems, total, _ := evaluator.ListTestItems(task.ID, 0, 0)
			for _, item := range testItems {
				if item.Status == evaluator.ItemStatusCompleted {
					completed++
					if item.EvalResult != nil && item.EvalResult.Label == "pass" {
						passed++
					}
				}
			}
			if total > 0 {
				progress = completed * 100 / total
			}
			var passRate float64
			if completed > 0 {
				passRate = float64(passed) / float64(completed) * 100
			}

			items = append(items, RecentTaskItem{
				ID:          task.ID,
				Name:        task.Name,
				Type:        "eval",
				Status:      task.Status,
				Progress:    progress,
				Total:       total,
				Completed:   completed,
				PassRate:    passRate,
				ExecutedAt:  task.UpdatedAt,
				ProjectName: projectName,
			})
		}
	}

	// 获取扫描任务运行结果
	scanItems, err := storage.ListByPrefix([]byte("scan:runs:ts:"), 0, maxListLimit)
	if err == nil {
		for _, item := range scanItems {
			runID := string(item.Value)
			metaKey := "scan:run:" + runID + ":meta"
			b, err := storage.Get([]byte(metaKey))
			if err != nil {
				continue
			}
			var rr scanner.RunResult
			if json.Unmarshal(b, &rr) != nil {
				continue
			}

			var passRate float64
			if rr.Total > 0 {
				passRate = float64(rr.Ok) / float64(rr.Total) * 100
			}

			// 根据运行结果推断状态
			status := "completed"
			if rr.Aborted {
				status = "aborted"
			}

			// 安全截取 runID
			nameID := rr.RunID
			if len(nameID) > 8 {
				nameID = nameID[:8]
			}

			items = append(items, RecentTaskItem{
				ID:         rr.RunID,
				Name:       "扫描任务 " + nameID,
				Type:       "scan",
				Status:     status,
				Progress:   100,
				Total:      rr.Total,
				Completed:  rr.Ok + rr.Failed,
				PassRate:   passRate,
				ExecutedAt: rr.StartedAt,
			})
		}
	}

	// 按执行时间降序排序
	sort.Slice(items, func(i, j int) bool {
		return items[i].ExecutedAt > items[j].ExecutedAt
	})

	// 限制返回数量
	if len(items) > limit {
		items = items[:limit]
	}

	// Cache the result
	s.setCache(cacheKey, items)
	return items, nil
}

// EvaluationReportData represents the full data structure for the report page.
type EvaluationReportData struct {
	Score       float64                 `json:"score"`
	TotalTests  int                     `json:"totalTests"`
	PassRate    string                  `json:"passRate"`
	AvgTime     string                  `json:"avgTime"`
	Security    ReportSecurityStats     `json:"security"`
	Tasks       []ReportTaskMetric      `json:"tasks"`
	Performance []ReportChartData       `json:"performance"`
	SampleCover ReportSampleStats       `json:"sampleCover"`
	TestCases   []ReportTestCaseResult  `json:"testCases"`
	Validation  ReportValidationResults `json:"validation"`
	QuickStats  ReportQuickStats        `json:"quickStats"`
	Research    ReportResearchInsights  `json:"research"`
	GeneratedAt string                  `json:"generatedAt"`
	ProjectInfo string                  `json:"projectInfo"`
}

type ReportSecurityStats struct {
	MCP   SecurityItem `json:"mcp"`
	Infra SecurityItem `json:"infra"`
	Cloud SecurityItem `json:"cloud"`
}

type SecurityItem struct {
	Status          string `json:"status"` // "secure", "warning", "danger"
	Findings        int    `json:"findings"`
	Vulnerabilities int    `json:"vulnerabilities"`
	Critical        int    `json:"critical"`
	RiskLevel       string `json:"riskLevel"`
	Threats         int    `json:"threats"`
}

type ReportTaskMetric struct {
	Name        string  `json:"name"`
	Total       int     `json:"total"`
	Completed   int     `json:"completed"`
	Failed      int     `json:"failed"`
	SuccessRate float64 `json:"successRate"`
}

type ReportChartData struct {
	Name      string  `json:"name"`
	Accuracy  float64 `json:"Accuracy"`
	Precision float64 `json:"Precision"`
	Recall    float64 `json:"Recall"`
}

type ReportSampleStats struct {
	Total   int     `json:"total"`
	Covered int     `json:"covered"`
	Rate    float64 `json:"rate"`
}

type ReportTestCaseResult struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Status      string `json:"status"` // "PASS", "FAIL"
	Time        string `json:"time"`
}

type ReportValidationResults struct {
	Input  string `json:"input"`  // "PASS", "FAIL"
	Output string `json:"output"` // "PASS", "FAIL"
	Schema string `json:"schema"` // "PASS", "FAIL"
}

type ReportQuickStats struct {
	PassCount  int     `json:"passCount"`
	FailCount  int     `json:"failCount"`
	SkipCount  int     `json:"skipCount"`
	PassRate   float64 `json:"passRate"`
	PeakMemory string  `json:"peakMemory"`
	AvgGPU     string  `json:"avgGPU"`
	Throughput string  `json:"throughput"`
	ErrorRate  string  `json:"errorRate"`
}

type ReportResearchInsights struct {
	PaperCount int      `json:"paperCount"`
	Findings   []string `json:"findings"`
}

// GetEvaluationReport aggregates all necessary data for the evaluation report.
func (s *DashboardService) GetEvaluationReport() (*EvaluationReportData, error) {
	// In a real scenario, we might accept optional filters (projectID, taskID, timeRange).
	// For now, we aggregate everything globally for demonstration.

	// 1. Collect Security Stats from real MCP, Nuclei, and CloudScan results.
	secStats := aggregateSecurityStats()

	// 2. Collect Evaluation Tasks & Metrics
	var tasks []ReportTaskMetric
	var totalTests, passedTests, failedTests int
	var totalDuration int64
	var taskCount int

	evalTasks, _, err := evaluator.ListTasks("", 0, 0)
	if err == nil {
		for _, task := range evalTasks {
			if task.Status != evaluator.TaskStatusCompleted {
				continue
			}
			taskCount++

			// Get items for this task
			items, _, _ := evaluator.ListTestItems(task.ID, 0, 0)

			tTotal := len(items)
			tCompleted := 0
			tFailed := 0
			tPassed := 0

			for _, item := range items {
				if item.Status == evaluator.ItemStatusCompleted {
					tCompleted++
					if item.DurationMs > 0 {
						totalDuration += item.DurationMs
					}
					if item.EvalResult != nil && item.EvalResult.Label == "pass" {
						tPassed++
						passedTests++
					} else {
						tFailed++
						failedTests++
					}
				}
			}
			totalTests += tTotal

			successRate := 0.0
			if tTotal > 0 {
				successRate = float64(tPassed) / float64(tTotal) * 100
			}

			tasks = append(tasks, ReportTaskMetric{
				Name:        task.Name,
				Total:       tTotal,
				Completed:   tCompleted,
				Failed:      tFailed,
				SuccessRate: successRate,
			})
		}
	}

	// 3. Calculate Global Metrics
	score := 0.0
	passRateStr := "0%"
	avgTimeStr := "0 ms"

	if totalTests > 0 {
		rate := float64(passedTests) / float64(totalTests) * 100
		score = rate // Simplified score logic
		passRateStr = fmt.Sprintf("%.1f%%", rate)

		if totalTests > 0 {
			avg := float64(totalDuration) / float64(totalTests)
			avgTimeStr = fmt.Sprintf("%.0f ms", avg)
		}
	}

	// 4. Mocking Test Cases (Top 5 recent) & Validation Results
	// In production, fetch real test case details
	var testCases []ReportTestCaseResult
	if len(evalTasks) > 0 {
		// Just take items from the most recent task
		recentTask := evalTasks[0] // list returns sorted desc? usually yes in this project
		items, _, _ := evaluator.ListTestItems(recentTask.ID, 0, 5)
		for _, item := range items {
			status := "FAIL"
			if item.EvalResult != nil && item.EvalResult.Label == "pass" {
				status = "PASS"
			}

			desc := "Test Execution"
			if len(item.TargetPrompt) > 20 {
				desc = item.TargetPrompt[:20] + "..."
			}

			id := item.ID
			if len(id) > 8 {
				id = id[:8]
			}
			testCases = append(testCases, ReportTestCaseResult{
				ID:          id,
				Description: desc,
				Status:      status,
				Time:        fmt.Sprintf("%.2fs", float64(item.DurationMs)/1000.0),
			})
		}
	}

	return &EvaluationReportData{
		Score:       score,
		TotalTests:  totalTests,
		PassRate:    passRateStr,
		AvgTime:     avgTimeStr,
		Security:    secStats,
		Tasks:       tasks,
		Performance: []ReportChartData{},
		SampleCover: ReportSampleStats{},
		TestCases:   testCases,
		Validation:  ReportValidationResults{},
		QuickStats: ReportQuickStats{
			PassCount: passedTests,
			FailCount: failedTests,
			SkipCount: totalTests - passedTests - failedTests,
			PassRate:  score,
		},
		Research:    ReportResearchInsights{},
		GeneratedAt: time.Now().Format("2006-01-02 15:04:05"),
	}, nil
}

// ============================================================
// Report Storage
// ============================================================

// Report represents a saved evaluation report.
type Report struct {
	ID          string                `json:"id"`
	ProjectID   string                `json:"projectId"`
	ProjectName string                `json:"projectName"`
	Status      string                `json:"status"` // "generating", "completed", "failed"
	CreatedAt   int64                 `json:"createdAt"`
	Data        *EvaluationReportData `json:"data,omitempty"`
}

// ReportListItem represents a report in the list view.
type ReportListItem struct {
	ID          string  `json:"id"`
	ProjectID   string  `json:"projectId"`
	ProjectName string  `json:"projectName"`
	Status      string  `json:"status"`
	CreatedAt   int64   `json:"createdAt"`
	Score       float64 `json:"score"`
	TotalTests  int     `json:"totalTests"`
}
