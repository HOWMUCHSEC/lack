package main

import (
	"encoding/json"
	"math"
	"testing"

	"lack-client/pkg/scanner"
	"lack-client/pkg/storage"
)

func setupReportTestStorage(t *testing.T) {
	t.Helper()

	if err := storage.Close(); err != nil {
		t.Fatalf("close existing storage: %v", err)
	}
	t.Setenv("HOME", t.TempDir())
	if err := storage.OpenAt(storage.DefaultPath()); err != nil {
		t.Fatalf("open test storage: %v", err)
	}
	t.Cleanup(func() {
		_ = storage.Close()
	})
}

func mustPutReportJSON(t *testing.T, key string, value any) {
	t.Helper()

	data, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal %s: %v", key, err)
	}
	if err := storage.Put([]byte(key), data); err != nil {
		t.Fatalf("put %s: %v", key, err)
	}
}

func assertReportFloatNear(t *testing.T, name string, got, want float64) {
	t.Helper()

	if math.Abs(got-want) > 0.01 {
		t.Fatalf("%s = %.4f, want %.4f", name, got, want)
	}
}

func TestGenerateReportDataPopulatesDerivedMetrics(t *testing.T) {
	setupReportTestStorage(t)

	const (
		projectID = "project-1"
		taskID    = "task-1"
		runID     = "run-1"
	)

	mustPutReportJSON(t, "task:"+taskID, map[string]any{
		"id":         taskID,
		"project_id": projectID,
		"title":      "Safety smoke task",
	})
	mustPutReportJSON(t, "taskdatasets:"+taskID, TaskDatasetConfig{
		TestCaseIds: []string{"sample-1", "sample-2", "sample-3"},
	})
	if err := storage.Put([]byte("scan:task:"+taskID+":runs:1000"), []byte(runID)); err != nil {
		t.Fatalf("put run index: %v", err)
	}
	mustPutReportJSON(t, "scan:run:"+runID+":meta", scanner.RunResult{
		RunID:      runID,
		TaskID:     taskID,
		StartedAt:  1000,
		FinishedAt: 3000,
		Total:      3,
		Ok:         2,
		Failed:     1,
	})
	steps := []scanner.StepResult{
		{
			RunID:       runID,
			TaskID:      taskID,
			SampleID:    "sample-1",
			Attempt:     1,
			StatusCode:  200,
			Success:     true,
			DurationMs:  100,
			ReqPreview:  `{"prompt":"one"}`,
			RespPreview: `{"answer":"safe"}`,
		},
		{
			RunID:       runID,
			TaskID:      taskID,
			SampleID:    "sample-2",
			Attempt:     1,
			StatusCode:  200,
			Success:     true,
			DurationMs:  300,
			ReqPreview:  `{"prompt":"two"}`,
			RespPreview: `{"answer":"safe"}`,
		},
		{
			RunID:       runID,
			TaskID:      taskID,
			SampleID:    "sample-3",
			Attempt:     1,
			StatusCode:  500,
			Success:     false,
			DurationMs:  200,
			ReqPreview:  `{"prompt":"three"}`,
			RespPreview: `{"error":"boom"}`,
		},
	}
	for i, step := range steps {
		mustPutReportJSON(t, "scan:run:"+runID+":step:0000"+string(rune('1'+i)), step)
	}

	data, err := NewReportService().generateReportDataForProject(projectID, "Demo Project", "target-model", "", "")
	if err != nil {
		t.Fatalf("generate report data: %v", err)
	}

	if data.TotalTests != 3 {
		t.Fatalf("TotalTests = %d, want 3", data.TotalTests)
	}
	if data.PassRate != "66.7%" {
		t.Fatalf("PassRate = %q, want 66.7%%", data.PassRate)
	}
	if data.AvgTime != "200 ms" {
		t.Fatalf("AvgTime = %q, want 200 ms", data.AvgTime)
	}
	if len(data.Performance) != 1 {
		t.Fatalf("len(Performance) = %d, want 1", len(data.Performance))
	}
	assertReportFloatNear(t, "Performance[0].Accuracy", data.Performance[0].Accuracy, 66.6667)
	assertReportFloatNear(t, "Performance[0].Precision", data.Performance[0].Precision, 100)
	assertReportFloatNear(t, "Performance[0].Recall", data.Performance[0].Recall, 100)
	if data.SampleCover.Total != 3 || data.SampleCover.Covered != 3 {
		t.Fatalf("SampleCover = %+v, want total=3 covered=3", data.SampleCover)
	}
	assertReportFloatNear(t, "SampleCover.Rate", data.SampleCover.Rate, 100)
	if data.Validation != (ReportValidationResults{Input: "PASS", Output: "PASS", Schema: "PASS"}) {
		t.Fatalf("Validation = %+v, want all PASS", data.Validation)
	}
	if data.QuickStats.PassCount != 2 || data.QuickStats.FailCount != 1 || data.QuickStats.SkipCount != 0 {
		t.Fatalf("QuickStats counts = %+v, want pass=2 fail=1 skip=0", data.QuickStats)
	}
	if data.QuickStats.Throughput != "1.50/s" {
		t.Fatalf("Throughput = %q, want 1.50/s", data.QuickStats.Throughput)
	}
	if data.QuickStats.ErrorRate != "33.3%" {
		t.Fatalf("ErrorRate = %q, want 33.3%%", data.QuickStats.ErrorRate)
	}
}
