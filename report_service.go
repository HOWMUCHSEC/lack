package main

import (
	"context"
	"encoding/json"
	"fmt"
	"lack-client/pkg/samples"
	"lack-client/pkg/scanner"
	"lack-client/pkg/storage"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/go-pdf/fpdf"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	reportKeyPrefix   = "report:"
	maxReportRunSteps = 500
)

// ReportService provides report CRUD and export services.
type ReportService struct {
	ctx context.Context
}

// NewReportService creates a new ReportService instance.
func NewReportService() *ReportService {
	return &ReportService{}
}

// Startup is called at application startup.
func (s *ReportService) Startup(ctx context.Context) {
	s.ctx = ctx
}

// ListReports returns all saved reports.
func (s *ReportService) ListReports() ([]ReportListItem, error) {
	items, err := storage.ListByPrefix([]byte(reportKeyPrefix), 0, maxListLimit)
	if err != nil {
		return nil, err
	}

	var reports []ReportListItem
	for _, item := range items {
		var r Report
		if err := json.Unmarshal(item.Value, &r); err != nil {
			continue
		}
		listItem := ReportListItem{
			ID:          r.ID,
			ProjectID:   r.ProjectID,
			ProjectName: r.ProjectName,
			Status:      r.Status,
			CreatedAt:   r.CreatedAt,
		}
		if r.Data != nil {
			listItem.Score = r.Data.Score
			listItem.TotalTests = r.Data.TotalTests
		}
		reports = append(reports, listItem)
	}

	// Sort by creation time descending
	sort.Slice(reports, func(i, j int) bool {
		return reports[i].CreatedAt > reports[j].CreatedAt
	})

	return reports, nil
}

// GetReportByID retrieves a specific report by ID.
func (s *ReportService) GetReportByID(id string) (*Report, error) {
	key := reportKeyPrefix + id
	b, err := storage.Get([]byte(key))
	if err != nil {
		return nil, fmt.Errorf("report not found: %s", id)
	}

	var r Report
	if err := json.Unmarshal(b, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

// GenerateReport generates a new report for the given project.
// Parameters: projectID, projectName - project identifiers from work planning
//
//	targetModel - the target model name displayed in UI
//	targetBaseUrl - the base URL from target metadata (for matching EvalProjects)
//	targetModelId - the model identifier from target metadata (for matching EvalProjects)
func (s *ReportService) GenerateReport(projectID, projectName, targetModel, targetBaseUrl, targetModelId string) (*Report, error) {
	// Generate unique report ID
	reportID := fmt.Sprintf("rpt_%d_%04x", time.Now().UnixMilli(), time.Now().UnixNano()&0xFFFF)

	// Create report record
	report := &Report{
		ID:          reportID,
		ProjectID:   projectID,
		ProjectName: projectName,
		Status:      "generating",
		CreatedAt:   time.Now().UnixMilli(),
	}

	// Save initial report state
	if err := s.saveReport(report); err != nil {
		return nil, err
	}

	// Generate report data
	data, err := s.generateReportDataForProject(projectID, projectName, targetModel, targetBaseUrl, targetModelId)
	if err != nil {
		report.Status = "failed"
		if saveErr := s.saveReport(report); saveErr != nil {
			return nil, fmt.Errorf("generate failed: %w; additionally failed to save error status: %v", err, saveErr)
		}
		return nil, err
	}

	// Update report with data
	report.Status = "completed"
	report.Data = data
	if err := s.saveReport(report); err != nil {
		return nil, err
	}

	return report, nil
}

func (s *ReportService) saveReport(r *Report) error {
	key := reportKeyPrefix + r.ID
	b, err := json.Marshal(r)
	if err != nil {
		return err
	}
	return storage.Put([]byte(key), b)
}

// DeleteReport deletes a report by ID.
func (s *ReportService) DeleteReport(id string) error {
	key := []byte(reportKeyPrefix + id)
	return storage.Delete(key)
}

func (s *ReportService) generateReportDataForProject(projectID, projectName, targetModel, targetBaseUrl, targetModelId string) (*EvaluationReportData, error) {
	// Generate report data from Work Planning tasks and scan results

	// 1. Security Stats (global for now)
	secStats := aggregateSecurityStats()

	// 2. Resolve the target (objective) ID from targetBaseUrl + targetModelId
	// so we can filter work-planning tasks by goal_id.
	targetID := s.resolveTargetID(projectID, targetBaseUrl, targetModelId)

	// 3. Find tasks under this project
	// Tasks are stored with key prefix "task:" and have project_id field
	taskItems, err := storage.ListByPrefix([]byte("task:"), 0, maxListLimit)
	if err != nil {
		return nil, fmt.Errorf("list tasks error: %w", err)
	}

	// Filter tasks by project_id and optionally by goal_id (target)
	var matchingTaskIDs []string
	for _, item := range taskItems {
		var task map[string]interface{}
		if err := json.Unmarshal(item.Value, &task); err != nil {
			continue
		}

		taskProjectID, _ := task["project_id"].(string)
		taskID, _ := task["id"].(string)
		deletedAt, _ := task["deleted_at"].(string)

		// Skip deleted tasks
		if deletedAt != "" {
			continue
		}

		// Match by project_id
		if taskProjectID != projectID {
			continue
		}

		// If a target was resolved, also filter by goal_id
		if targetID != "" {
			taskGoalID, _ := task["goal_id"].(string)
			if taskGoalID != "" && taskGoalID != targetID {
				continue
			}
		}

		matchingTaskIDs = append(matchingTaskIDs, taskID)
	}

	// 4. Aggregate scan run results from matching tasks
	var tasks []ReportTaskMetric
	var performance []ReportChartData
	var totalTests, passedTests, failedTests int
	var totalWallDuration int64
	var totalStepDuration int64
	var stepDurationCount int
	var recentTestCases []ReportTestCaseResult
	configuredSampleTotal := 0
	coveredSamples := make(map[string]struct{})
	hasRunData := false
	hasStepData := false
	hasSuccessfulStep := false
	inputValid := true
	outputValid := true
	schemaValid := true

	for _, taskID := range matchingTaskIDs {
		taskConfiguredSamples := s.countConfiguredSamplesForTask(taskID)
		configuredSampleTotal += taskConfiguredSamples
		taskCoveredSamples := make(map[string]struct{})

		// Get all scan runs for this task
		runPrefix := fmt.Sprintf("scan:task:%s:runs:", taskID)
		runItems, err := storage.ListByPrefix([]byte(runPrefix), 0, maxListLimit)
		if err != nil {
			continue
		}

		var taskTotal, taskOk, taskFailed int

		for _, runItem := range runItems {
			runID := string(runItem.Value)
			metaKey := fmt.Sprintf("scan:run:%s:meta", runID)
			metaData, err := storage.Get([]byte(metaKey))
			if err != nil {
				continue
			}

			var rr scanner.RunResult
			if json.Unmarshal(metaData, &rr) != nil {
				continue
			}

			hasRunData = true
			if rr.Total < 0 || rr.Ok < 0 || rr.Failed < 0 || rr.Ok+rr.Failed > rr.Total {
				schemaValid = false
			}

			taskTotal += rr.Total
			taskOk += rr.Ok
			taskFailed += rr.Failed
			totalTests += rr.Total
			passedTests += rr.Ok
			failedTests += rr.Failed

			// Calculate duration from run
			if rr.FinishedAt > 0 && rr.StartedAt > 0 && rr.FinishedAt >= rr.StartedAt {
				totalWallDuration += rr.FinishedAt - rr.StartedAt
			}

			stepPrefix := fmt.Sprintf("scan:run:%s:step:", runID)
			stepItems, _ := storage.ListByPrefix([]byte(stepPrefix), 0, maxReportRunSteps)
			for _, stepItem := range stepItems {
				var step scanner.StepResult
				if json.Unmarshal(stepItem.Value, &step) != nil {
					schemaValid = false
					continue
				}

				hasStepData = true
				if step.RunID == "" || step.TaskID == "" {
					schemaValid = false
				}
				if !reportStepHasRequestData(step) {
					inputValid = false
				}
				if step.Success {
					hasSuccessfulStep = true
					if !reportStepHasResponseData(step) {
						outputValid = false
					}
				}
				if step.SampleID != "" {
					key := reportSampleKey(taskID, step.SampleID)
					coveredSamples[key] = struct{}{}
					taskCoveredSamples[key] = struct{}{}
				}
				if step.DurationMs > 0 {
					totalStepDuration += step.DurationMs
					stepDurationCount++
				}

				// Collect recent test cases from step results (up to 10 total)
				if len(recentTestCases) < 10 {
					status := "FAIL"
					if step.Success {
						status = "PASS"
					}
					recentTestCases = append(recentTestCases, ReportTestCaseResult{
						ID:          step.SampleID,
						Description: reportStepDescription(step),
						Status:      status,
						Time:        fmt.Sprintf("%.2fs", float64(step.DurationMs)/1000.0),
					})
				}
			}
		}

		// Get task name from storage
		taskKey := []byte("task:" + taskID)
		taskData, _ := storage.Get(taskKey)
		taskName := taskID
		if len(taskData) > 0 {
			var taskMap map[string]interface{}
			if json.Unmarshal(taskData, &taskMap) == nil {
				if name, ok := taskMap["title"].(string); ok && name != "" {
					taskName = name
				}
			}
		}

		successRate := 0.0
		if taskTotal > 0 {
			successRate = float64(taskOk) / float64(taskTotal) * 100
		}

		if taskTotal > 0 { // Only add tasks with actual data
			tasks = append(tasks, ReportTaskMetric{
				Name:        taskName,
				Total:       taskTotal,
				Completed:   taskOk + taskFailed,
				Failed:      taskFailed,
				SuccessRate: successRate,
			})

			recall := 100.0
			if taskConfiguredSamples > 0 {
				recall = reportPercent(len(taskCoveredSamples), taskConfiguredSamples)
			}
			performance = append(performance, ReportChartData{
				Name:      taskName,
				Accuracy:  successRate,
				Precision: reportPercent(taskOk+taskFailed, taskTotal),
				Recall:    recall,
			})
		}
	}

	// 5. Calculate metrics
	score := 0.0
	passRateStr := "0%"
	avgTimeStr := "0 ms"
	throughputStr := "N/A"
	errorRateStr := "0%"
	skipCount := totalTests - passedTests - failedTests
	if skipCount < 0 {
		skipCount = 0
	}

	if totalTests > 0 {
		rate := float64(passedTests) / float64(totalTests) * 100
		score = rate
		passRateStr = fmt.Sprintf("%.1f%%", rate)
		errorRateStr = fmt.Sprintf("%.1f%%", float64(failedTests)/float64(totalTests)*100)
		if stepDurationCount > 0 {
			avg := float64(totalStepDuration) / float64(stepDurationCount)
			avgTimeStr = fmt.Sprintf("%.0f ms", avg)
		} else if totalWallDuration > 0 {
			avg := float64(totalWallDuration) / float64(totalTests)
			avgTimeStr = fmt.Sprintf("%.0f ms", avg)
		}
		durationForThroughput := totalWallDuration
		if durationForThroughput <= 0 {
			durationForThroughput = totalStepDuration
		}
		if durationForThroughput > 0 {
			throughput := float64(totalTests) / (float64(durationForThroughput) / 1000.0)
			throughputStr = fmt.Sprintf("%.2f/s", throughput)
		}
	}

	sampleTotal := configuredSampleTotal
	sampleCovered := len(coveredSamples)
	if sampleTotal <= 0 {
		sampleTotal = totalTests
		sampleCovered = passedTests + failedTests
	}
	if sampleCovered > sampleTotal {
		sampleCovered = sampleTotal
	}
	sampleCover := ReportSampleStats{
		Total:   sampleTotal,
		Covered: sampleCovered,
		Rate:    reportPercent(sampleCovered, sampleTotal),
	}
	validation := ReportValidationResults{
		Input:  reportValidationStatus(hasStepData, inputValid),
		Output: reportValidationStatus(hasSuccessfulStep, outputValid),
		Schema: reportValidationStatus(hasRunData, schemaValid),
	}

	// Build project info with target model name when available
	projectInfo := projectName
	if targetModel != "" {
		projectInfo = fmt.Sprintf("%s — %s", projectName, targetModel)
	}

	return &EvaluationReportData{
		Score:       score,
		TotalTests:  totalTests,
		PassRate:    passRateStr,
		AvgTime:     avgTimeStr,
		Security:    secStats,
		Tasks:       tasks,
		Performance: performance,
		SampleCover: sampleCover,
		TestCases:   recentTestCases,
		Validation:  validation,
		QuickStats: ReportQuickStats{
			PassCount:  passedTests,
			FailCount:  failedTests,
			SkipCount:  skipCount,
			PassRate:   score,
			PeakMemory: "N/A",
			AvgGPU:     "N/A",
			Throughput: throughputStr,
			ErrorRate:  errorRateStr,
		},
		Research:    ReportResearchInsights{},
		GeneratedAt: time.Now().Format("2006-01-02 15:04:05"),
		ProjectInfo: projectInfo,
	}, nil
}

func reportSampleKey(taskID, sampleID string) string {
	return taskID + "\x00" + sampleID
}

func reportPercent(numerator, denominator int) float64 {
	if denominator <= 0 {
		return 0
	}
	rate := float64(numerator) / float64(denominator) * 100
	if rate < 0 {
		return 0
	}
	if rate > 100 {
		return 100
	}
	return rate
}

func reportValidationStatus(hasData, ok bool) string {
	if hasData && ok {
		return "PASS"
	}
	return "FAIL"
}

func reportStepHasRequestData(step scanner.StepResult) bool {
	return strings.TrimSpace(step.ReqPreview) != "" ||
		strings.TrimSpace(step.FinalRequest.BodyJSON) != "" ||
		strings.TrimSpace(step.FinalRequest.BaseURL) != ""
}

func reportStepHasResponseData(step scanner.StepResult) bool {
	return strings.TrimSpace(step.RespPreview) != "" ||
		strings.TrimSpace(step.ResponseBody) != ""
}

func reportStepDescription(step scanner.StepResult) string {
	desc := strings.TrimSpace(step.ReqPreview)
	if desc == "" {
		desc = "Scan Test"
	}
	runes := []rune(desc)
	if len(runes) > 20 {
		return string(runes[:20]) + "..."
	}
	return desc
}

func (s *ReportService) countConfiguredSamplesForTask(taskID string) int {
	data, err := storage.Get([]byte("taskdatasets:" + taskID))
	if err != nil || len(data) == 0 {
		return 0
	}

	var cfg TaskDatasetConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return 0
	}

	total := len(cfg.TestCaseIds) + len(cfg.CommunityIds)
	for _, setID := range cfg.LocalSampleSetIds {
		set, err := samples.GetSampleSet(setID)
		if err == nil && set != nil {
			total += set.SampleCount
		}
	}
	total += len(cfg.CloudSampleSetIds)
	for _, hfID := range cfg.HfDatasetIds {
		parts := splitHfDatasetID(hfID)
		if len(parts) < 3 {
			continue
		}
		rows := samples.GetHfDatasetRows(parts[0], parts[1], parts[2], 0, 1)
		total += rows.Total
	}
	return total
}

// resolveTargetID finds the target (objective) ID that matches the given
// baseUrl and modelId under the specified project. It scans all targets stored
// with the "target:" key prefix and returns the first match, or "" if none found.
func (s *ReportService) resolveTargetID(projectID, baseUrl, modelId string) string {
	if baseUrl == "" && modelId == "" {
		return ""
	}

	items, err := storage.ListByPrefix([]byte("target:"), 0, maxListLimit)
	if err != nil {
		return ""
	}

	for _, item := range items {
		var target map[string]interface{}
		if err := json.Unmarshal(item.Value, &target); err != nil {
			continue
		}

		// Only consider targets belonging to this project
		tProjectID, _ := target["project_id"].(string)
		if tProjectID != projectID {
			continue
		}

		// Match by metadata.base_url and metadata.model_name
		meta, _ := target["metadata"].(map[string]interface{})
		if meta == nil {
			continue
		}

		tBaseUrl, _ := meta["base_url"].(string)
		tModelName, _ := meta["model_name"].(string)

		if baseUrl != "" && tBaseUrl != baseUrl {
			continue
		}
		if modelId != "" && tModelName != modelId {
			continue
		}

		// Found a match
		if id, ok := target["id"].(string); ok {
			return id
		}
	}

	return ""
}

// ExportReport exports a report to a file selected by the user.
func (s *ReportService) ExportReport(id string) error {
	path, err := runtime.SaveFileDialog(s.ctx, runtime.SaveDialogOptions{
		Title:           "Export Report",
		DefaultFilename: fmt.Sprintf("report_%s.json", id),
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
		},
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil // User cancelled
	}

	report, err := s.GetReportByID(id)
	if err != nil {
		return err
	}

	// Format the report data (e.g. JSON with indentation)
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

// ExportReportAsPDF exports a report to a PDF file selected by the user.
func (s *ReportService) ExportReportAsPDF(id string) error {
	path, err := runtime.SaveFileDialog(s.ctx, runtime.SaveDialogOptions{
		Title:           "导出 PDF 报告",
		DefaultFilename: fmt.Sprintf("Evaluation_Report_%s.pdf", id),
		Filters: []runtime.FileFilter{
			{DisplayName: "PDF Files", Pattern: "*.pdf"},
		},
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil // User cancelled
	}

	report, err := s.GetReportByID(id)
	if err != nil {
		return err
	}

	return s.generatePDFFile(report, path)
}

// generatePDFFile creates a proper PDF file using fpdf library
func (s *ReportService) generatePDFFile(report *Report, path string) error {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.AddPage()

	// Title - Using English as fpdf doesn't support Chinese well without custom fonts
	pdf.SetFont("Helvetica", "B", 20)
	pdf.CellFormat(0, 12, "Model Evaluation Report", "", 1, "C", false, 0, "")
	pdf.Ln(5)

	if report.Data == nil {
		pdf.SetFont("Helvetica", "", 12)
		pdf.Cell(0, 10, "No report data available.")
		return pdf.OutputFileAndClose(path)
	}
	d := report.Data

	// Project Info
	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(100, 100, 100)
	pdf.CellFormat(0, 6, fmt.Sprintf("Project: %s  |  Generated: %s", report.ProjectName, d.GeneratedAt), "", 1, "C", false, 0, "")
	pdf.Ln(8)

	// Summary Metrics Section
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Helvetica", "B", 14)
	pdf.Cell(0, 8, "Summary / Overview")
	pdf.Ln(10)

	pdf.SetFont("Helvetica", "", 11)
	pdf.Cell(0, 6, fmt.Sprintf("Overall Score: %.1f", d.Score))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Total Tests: %d", d.TotalTests))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Pass Rate: %s", d.PassRate))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Avg Response Time: %s", d.AvgTime))
	pdf.Ln(10)

	// Task Metrics Section
	pdf.SetFont("Helvetica", "B", 14)
	pdf.Cell(0, 8, "Task Completion Metrics")
	pdf.Ln(10)

	pdf.SetFont("Helvetica", "", 10)
	for _, task := range d.Tasks {
		pdf.Cell(0, 5, fmt.Sprintf("- %s: %d/%d (%.1f%%)", task.Name, task.Completed, task.Total, task.SuccessRate))
		pdf.Ln(5)
	}
	pdf.Ln(5)

	// Sample Coverage Section
	pdf.SetFont("Helvetica", "B", 14)
	pdf.Cell(0, 8, "Sample Coverage")
	pdf.Ln(10)

	pdf.SetFont("Helvetica", "", 11)
	pdf.Cell(0, 6, fmt.Sprintf("Coverage Rate: %.1f%% (%d / %d)", d.SampleCover.Rate, d.SampleCover.Covered, d.SampleCover.Total))
	pdf.Ln(10)

	// Test Cases Section
	pdf.SetFont("Helvetica", "B", 14)
	pdf.Cell(0, 8, "Test Case Results")
	pdf.Ln(10)

	pdf.SetFont("Helvetica", "", 10)
	for i, tc := range d.TestCases {
		if i >= 10 {
			pdf.Cell(0, 5, fmt.Sprintf("... and %d more", len(d.TestCases)-10))
			pdf.Ln(5)
			break
		}
		status := tc.Status
		pdf.Cell(0, 5, fmt.Sprintf("[%s] %s: %s (%s)", status, tc.ID, tc.Description, tc.Time))
		pdf.Ln(5)
	}
	pdf.Ln(5)

	// Quick Stats Section
	pdf.SetFont("Helvetica", "B", 14)
	pdf.Cell(0, 8, "Quick Stats")
	pdf.Ln(10)

	pdf.SetFont("Helvetica", "", 11)
	pdf.Cell(0, 6, fmt.Sprintf("Pass: %d", d.QuickStats.PassCount))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Fail: %d", d.QuickStats.FailCount))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Skip: %d", d.QuickStats.SkipCount))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Pass Rate: %.1f%%", d.QuickStats.PassRate))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Peak Memory: %s", d.QuickStats.PeakMemory))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Avg GPU Utilization: %s", d.QuickStats.AvgGPU))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Throughput: %s", d.QuickStats.Throughput))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Error Rate: %s", d.QuickStats.ErrorRate))

	return pdf.OutputFileAndClose(path)
}

// ExportReportAsMarkdown exports a report to a Markdown file selected by the user.
func (s *ReportService) ExportReportAsMarkdown(id string) error {
	path, err := runtime.SaveFileDialog(s.ctx, runtime.SaveDialogOptions{
		Title:           "导出 Markdown 报告",
		DefaultFilename: fmt.Sprintf("Evaluation_Report_%s.md", id),
		Filters: []runtime.FileFilter{
			{DisplayName: "Markdown Files", Pattern: "*.md"},
		},
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil // User cancelled
	}

	report, err := s.GetReportByID(id)
	if err != nil {
		return err
	}

	mdContent := s.generateMarkdownContent(report)
	return os.WriteFile(path, []byte(mdContent), 0644)
}

func (s *ReportService) generateMarkdownContent(report *Report) string {
	if report.Data == nil {
		return "# No report data available."
	}
	d := report.Data

	content := fmt.Sprintf(`# 模型评测报告

**Project:** %s
**Generated At:** %s

## 性能概要
- 综合评分: %.1f
- 测试总数: %d
- 通过率: %s
- 平均响应时间: %s

## 任务完成指标
| 任务名称 | 总数 | 完成 | 成功率 |
| --- | --- | --- | --- |
`, report.ProjectName, d.GeneratedAt, d.Score, d.TotalTests, d.PassRate, d.AvgTime)

	for _, task := range d.Tasks {
		content += fmt.Sprintf("| %s | %d | %d | %.1f%% |\n", task.Name, task.Total, task.Completed, task.SuccessRate)
	}

	content += fmt.Sprintf(`
## 样本覆盖率
- 覆盖率: %.1f%%
- 已覆盖: %d / %d

## 测试用例结果
| ID | 描述 | 状态 | 耗时 |
| --- | --- | --- | --- |
`, d.SampleCover.Rate, d.SampleCover.Covered, d.SampleCover.Total)

	for _, tc := range d.TestCases {
		content += fmt.Sprintf("| `%s` | %s | %s | %s |\n", tc.ID, tc.Description, tc.Status, tc.Time)
	}

	content += fmt.Sprintf(`
## 快速统计
- 通过: %d
- 失败: %d
- 跳过: %d
- 通过率: %.1f%%
- 峰值内存: %s
- 平均GPU: %s
- 吞吐量: %s
- 错误率: %s
`, d.QuickStats.PassCount, d.QuickStats.FailCount, d.QuickStats.SkipCount, d.QuickStats.PassRate, d.QuickStats.PeakMemory, d.QuickStats.AvgGPU, d.QuickStats.Throughput, d.QuickStats.ErrorRate)

	return content
}
