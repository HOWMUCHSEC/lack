package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"lack-client/pkg/logger"
	"lack-client/pkg/samples"
	"lack-client/pkg/scanner"
	"lack-client/pkg/storage"
	"lack-client/pkg/utils"

	badger "github.com/dgraph-io/badger/v4"
)

// SampleService provides sample management services exposed to the frontend.
type SampleService struct {
	migrateOnce sync.Once
}

// NewSampleService creates a new SampleService instance.
func NewSampleService() *SampleService {
	return &SampleService{}
}

// ensureMigration ensures migration runs only once (lazy execution on first use).
// Note: sync.Once acts as an extra protection layer, mainly relying on persistence marker in storage.
func (s *SampleService) ensureMigration() {
	s.migrateOnce.Do(func() {
		go s.migrateOldTaskDatasets()
	})
}

// migrateOldTaskDatasets migrates old task:datasets: prefix data to taskdatasets:
// and cleans up invalid task: prefix data (data without title field).
// Uses a marker to ensure execution only once.
func (s *SampleService) migrateOldTaskDatasets() {
	migrationKey := []byte("migration:task_datasets_v1")
	// Check if migration has already been executed
	if _, err := storage.Get(migrationKey); err == nil {
		return // Already migrated, skip
	}

	// 1. Migrate task:datasets: to taskdatasets:
	oldPrefix := []byte("task:datasets:")
	items, err := storage.ListByPrefix(oldPrefix, 0, 0)
	if err != nil {
		logger.Warn("migrateOldTaskDatasets list error", "error", err)
	} else if len(items) > 0 {
		logger.Info("migrateOldTaskDatasets found old data", "count", len(items))
		for _, item := range items {
			oldKey := string(item.Key)
			taskID := oldKey[len("task:datasets:"):]
			newKey := []byte("taskdatasets:" + taskID)
			if err := storage.Put(newKey, item.Value); err != nil {
				logger.Warn("migrateOldTaskDatasets put error", "taskID", taskID, "error", err)
				continue
			}
			if err := storage.Delete(item.Key); err != nil {
				logger.Warn("migrateOldTaskDatasets delete error", "taskID", taskID, "error", err)
			}
		}
		logger.Info("migrateOldTaskDatasets completed", "migrated", len(items))
	}

	// 2. Cleanup invalid task: prefix data (missing title field)
	taskPrefix := []byte("task:")
	taskItems, err := storage.ListByPrefix(taskPrefix, 0, 0)
	if err != nil {
		logger.Warn("cleanupInvalidTasks list error", "error", err)
	} else {
		var invalidKeys [][]byte
		for _, item := range taskItems {
			var data map[string]any
			if err := json.Unmarshal(item.Value, &data); err != nil {
				invalidKeys = append(invalidKeys, item.Key)
				continue
			}
			if _, ok := data["title"]; !ok {
				invalidKeys = append(invalidKeys, item.Key)
			}
		}
		if len(invalidKeys) > 0 {
			logger.Info("cleanupInvalidTasks found invalid tasks", "count", len(invalidKeys))
			for _, key := range invalidKeys {
				if err := storage.Delete(key); err != nil {
					logger.Warn("cleanupInvalidTasks delete error", "key", string(key), "error", err)
				}
			}
			logger.Info("cleanupInvalidTasks completed", "deleted", len(invalidKeys))
		}
	}

	// Mark migration as completed
	_ = storage.Put(migrationKey, []byte("done"))
}

// ExtractPlaceholders extracts placeholder variable names from content.
func (s *SampleService) ExtractPlaceholders(content string) []string {
	return utils.ExtractPlaceholders(content)
}

// GenerateSamples creates samples based on test cases and variables.
func (s *SampleService) GenerateSamples(req samples.GenerateRequest) samples.GenerateResult {
	return samples.GenerateSamples(req)
}

// ListSampleSets lists all sample sets.
func (s *SampleService) ListSampleSets(offset, limit int) samples.ListResult {
	return samples.ListSampleSets(offset, limit)
}

// SearchSampleSets searches sample sets by query string.
func (s *SampleService) SearchSampleSets(query string, offset, limit int) samples.ListResult {
	return samples.SearchSampleSets(query, offset, limit)
}

// ListSamplesBySet lists all samples under a specific set.
func (s *SampleService) ListSamplesBySet(setID string, offset, limit int) samples.ListResult {
	return samples.ListSamplesBySet(setID, offset, limit)
}

// GetSample returns a single sample.
func (s *SampleService) GetSample(sampleID string) (*samples.Sample, error) {
	return samples.GetSample(sampleID)
}

// GetSampleSet returns a single sample set.
func (s *SampleService) GetSampleSet(setID string) (*samples.SampleSet, error) {
	return samples.GetSampleSet(setID)
}

// DeleteSampleSet deletes a sample set and all its samples.
func (s *SampleService) DeleteSampleSet(setID string) error {
	return samples.DeleteSampleSet(setID)
}

// DeleteSample deletes a single sample.
func (s *SampleService) DeleteSample(sampleID string) error {
	return samples.DeleteSample(sampleID)
}

// TaskDatasetConfig defines the dataset configuration for a task.
type TaskDatasetConfig struct {
	TestCaseIds       []string          `json:"testCaseIds"`       // Test case IDs
	CommunityIds      []string          `json:"communityIds"`      // Community sample IDs
	HfDatasetIds      []string          `json:"hfDatasetIds"`      // Public dataset IDs (repoId:config:split)
	FieldMappings     map[string]string `json:"fieldMappings"`     // Field mappings: source field -> standard field
	// Compatible with old data
	LocalSampleSetIds []string `json:"localSampleSetIds,omitempty"`
	CloudSampleSetIds []string `json:"cloudSampleSetIds,omitempty"`
}

// UnifiedSample represents a unified sample format supporting both local and cloud samples.
type UnifiedSample struct {
	ID               string `json:"id"`
	Source           string `json:"source"` // "local" or "cloud"
	Content          string `json:"content"`
	Category         string `json:"category,omitempty"`
	Severity         string `json:"severity,omitempty"`
	ExpectedOutput   string `json:"expectedOutput,omitempty"`
}

// GetTaskDatasetConfig returns the dataset configuration for a task.
func (s *SampleService) GetTaskDatasetConfig(taskID string) (*TaskDatasetConfig, error) {
	s.ensureMigration()
	key := []byte("taskdatasets:" + taskID)
	data, err := storage.Get(key)
	if err != nil {
		// If key not found, return empty config instead of error
		if err == badger.ErrKeyNotFound {
			return &TaskDatasetConfig{
				TestCaseIds:  []string{},
				CommunityIds: []string{},
				HfDatasetIds: []string{},
			}, nil
		}
		return nil, err
	}
	var cfg TaskDatasetConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	// Ensure returning empty slice instead of nil
	if cfg.TestCaseIds == nil {
		cfg.TestCaseIds = []string{}
	}
	if cfg.CommunityIds == nil {
		cfg.CommunityIds = []string{}
	}
	if cfg.HfDatasetIds == nil {
		cfg.HfDatasetIds = []string{}
	}
	return &cfg, nil
}

// SaveTaskDatasetConfig saves the dataset configuration for a task.
func (s *SampleService) SaveTaskDatasetConfig(taskID string, cfg TaskDatasetConfig) error {
	if taskID == "" {
		return nil
	}
	key := []byte("taskdatasets:" + taskID)
	data, err := json.Marshal(cfg)
	if err != nil {
		logger.Error("SaveTaskDatasetConfig marshal error", "error", err)
		return err
	}
	if err := storage.Put(key, data); err != nil {
		logger.Error("SaveTaskDatasetConfig put error", "error", err)
		return err
	}
	logger.Info("SaveTaskDatasetConfig success",
		"taskID", taskID,
		"testCases", len(cfg.TestCaseIds),
		"community", len(cfg.CommunityIds),
		"hfDatasets", len(cfg.HfDatasetIds))
	return nil
}

// DeleteTaskConfig deletes all local configuration for a task (cleanup orphan data).
func (s *SampleService) DeleteTaskConfig(taskID string) error {
	if taskID == "" {
		return nil
	}
	var errs []error

	// 1. Delete dataset config
	datasetKey := []byte("taskdatasets:" + taskID)
	if err := storage.Delete(datasetKey); err != nil && err != badger.ErrKeyNotFound {
		logger.Error("DeleteTaskConfig datasets error", "taskID", taskID, "error", err)
		errs = append(errs, err)
	}

	// 2. Delete scan config
	scanCfgKey := []byte("scan:cfg:" + taskID)
	if err := storage.Delete(scanCfgKey); err != nil && err != badger.ErrKeyNotFound {
		logger.Error("DeleteTaskConfig scan:cfg error", "taskID", taskID, "error", err)
		errs = append(errs, err)
	}

	logger.Info("DeleteTaskConfig completed", "taskID", taskID, "errorCount", len(errs))
	if len(errs) > 0 {
		return errs[0]
	}
	return nil
}

// CountSamplesForTask counts the total number of samples associated with a task.
func (s *SampleService) CountSamplesForTask(taskID string) (int, error) {
	cfg, err := s.GetTaskDatasetConfig(taskID)
	if err != nil {
		return 0, err
	}

	total := 0

	// Count local sample sets
	for _, setID := range cfg.LocalSampleSetIds {
		set, err := samples.GetSampleSet(setID)
		if err == nil && set != nil {
			total += set.SampleCount
		}
	}

	// Count cloud sample sets (each set counts as one entry here, likely simplified logic)
	total += len(cfg.CloudSampleSetIds)

	return total, nil
}

// loadLocalSamples loads samples from local sample sets and returns them as UnifiedSample slice.
func (s *SampleService) loadLocalSamples(setIDs []string) []UnifiedSample {
	var result []UnifiedSample
	for _, setID := range setIDs {
		listResult := samples.ListSamplesBySet(setID, 0, 0) // 0 limit means fetch all
		if items, ok := listResult.Items.([]samples.Sample); ok {
			for _, item := range items {
				result = append(result, UnifiedSample{
					ID:       item.ID,
					Source:   "local",
					Content:  item.GeneratedContent,
					Category: item.Category,
					Severity: item.Severity,
				})
			}
		}
	}
	return result
}

// loadCloudSamples loads samples from cloud sample sets and returns them as UnifiedSample slice.
func (s *SampleService) loadCloudSamples(setIDs []string) []UnifiedSample {
	var result []UnifiedSample
	for _, setID := range setIDs {
		key := []byte("sets:" + setID)
		data, err := storage.Get(key)
		if err != nil {
			continue // Skip if not found
		}
		var cloudSet struct {
			ID             string `json:"id"`
			LabelLv1       string `json:"label_lv1"`
			PromptText     string `json:"prompt_text"`
			ExpectedOutput string `json:"expected_output"`
		}
		if err := json.Unmarshal(data, &cloudSet); err != nil {
			continue
		}
		result = append(result, UnifiedSample{
			ID:             cloudSet.ID,
			Source:         "cloud",
			Content:        cloudSet.PromptText,
			Category:       cloudSet.LabelLv1,
			ExpectedOutput: cloudSet.ExpectedOutput,
		})
	}
	return result
}

// GetSamplesForTask returns all samples associated with a task.
func (s *SampleService) GetSamplesForTask(taskID string) ([]UnifiedSample, error) {
	cfg, err := s.GetTaskDatasetConfig(taskID)
	if err != nil {
		return []UnifiedSample{}, err
	}

	allSamples := make([]UnifiedSample, 0)

	// 1. Get samples from local sets
	allSamples = append(allSamples, s.loadLocalSamples(cfg.LocalSampleSetIds)...)

	// 2. Get samples from cloud sets
	allSamples = append(allSamples, s.loadCloudSamples(cfg.CloudSampleSetIds)...)

	return allSamples, nil
}

// GetSamplesForTaskByConfig fetches samples directly from configuration (for frontend use).
func (s *SampleService) GetSamplesForTaskByConfig(localSetIds, cloudSetIds []string) ([]UnifiedSample, error) {
	allSamples := make([]UnifiedSample, 0)

	// 1. Get samples from local sets
	allSamples = append(allSamples, s.loadLocalSamples(localSetIds)...)

	// 2. Get samples from cloud sets
	allSamples = append(allSamples, s.loadCloudSamples(cloudSetIds)...)

	return allSamples, nil
}

// ============== HF Public Dataset Methods ==============
// =======================================================

// SaveHfDataset saves an HF dataset to local storage.
func (s *SampleService) SaveHfDataset(meta samples.HfDatasetMeta, rows []samples.HfDataRow) error {
	return samples.SaveHfDataset(meta, rows)
}

// ListDownloadedHfDatasets lists all downloaded HF datasets.
func (s *SampleService) ListDownloadedHfDatasets() ([]samples.HfDatasetMeta, error) {
	return samples.ListDownloadedHfDatasets()
}

// GetHfDatasetMeta returns metadata for a specific HF dataset.
func (s *SampleService) GetHfDatasetMeta(repoID, config, split string) (*samples.HfDatasetMeta, error) {
	return samples.GetHfDatasetMeta(repoID, config, split)
}

// GetHfDatasetRows returns paginated rows for an HF dataset.
func (s *SampleService) GetHfDatasetRows(repoID, config, split string, offset, limit int) samples.ListResult {
	return samples.GetHfDatasetRows(repoID, config, split, offset, limit)
}

// DeleteHfDataset deletes a downloaded HF dataset.
func (s *SampleService) DeleteHfDataset(repoID, config, split string) error {
	return samples.DeleteHfDataset(repoID, config, split)
}

// IsHfDatasetDownloaded checks if an HF dataset is downloaded.
func (s *SampleService) IsHfDatasetDownloaded(repoID, config, split string) bool {
	return samples.IsHfDatasetDownloaded(repoID, config, split)
}

// ListDownloadedCommunityPrompts lists all downloaded community prompts.
func (s *SampleService) ListDownloadedCommunityPrompts() ([]samples.CommunityPrompt, error) {
	return samples.ListDownloadedCommunityPrompts()
}

// DeleteCommunityPrompt deletes a downloaded community prompt.
func (s *SampleService) DeleteCommunityPrompt(id int64) error {
	return samples.DeleteCommunityPrompt(id)
}

// splitHfDatasetID parses HF dataset ID (format: repoId:config:split).
func splitHfDatasetID(id string) []string {
	return strings.SplitN(id, ":", 3)
}

// LoadSamplesForTask loads all samples from task configuration and converts them to scanner.Sample format.
func (s *SampleService) LoadSamplesForTask(taskID string) ([]scanner.Sample, error) {
	var result []scanner.Sample

	// 1. Get task dataset config
	cfg, err := s.GetTaskDatasetConfig(taskID)
	if err != nil {
		return nil, err
	}

	// 2. Load test cases
	if len(cfg.TestCaseIds) > 0 {
		for _, tcID := range cfg.TestCaseIds {
			key := []byte("testcase:" + tcID)
			data, err := storage.Get(key)
			if err != nil {
				continue
			}
			var tc TestCase
			if json.Unmarshal(data, &tc) == nil && tc.Status == "active" {
				result = append(result, scanner.Sample{
					ID:     tc.ID,
					Prompt: tc.Content,
					Meta: map[string]any{
						"source":   "testcase",
						"category": tc.Category,
						"severity": tc.Severity,
						"title":    tc.Title,
					},
				})
			}
		}
	}

	// 3. Load community samples
	if len(cfg.CommunityIds) > 0 {
		communityPrompts, _ := samples.ListDownloadedCommunityPrompts()
		idSet := make(map[string]bool)
		for _, id := range cfg.CommunityIds {
			idSet[id] = true
		}
		for _, cp := range communityPrompts {
			cpID := fmt.Sprintf("%d", cp.ID)
			if idSet[cpID] {
				result = append(result, scanner.Sample{
					ID:     cpID,
					Prompt: cp.PromptText,
					Meta: map[string]any{
						"source":     "community",
						"labelLv1":   cp.LabelLv1,
						"labelLv2":   cp.LabelLv2,
						"promptHash": cp.PromptHash,
					},
				})
			}
		}
	}

	// 4. Load HF datasets (format: repoId:config:split)
	if len(cfg.HfDatasetIds) > 0 {
		for _, hfID := range cfg.HfDatasetIds {
			// Parse repoId:config:split (separated by :)
			parts := splitHfDatasetID(hfID)
			if len(parts) < 3 {
				logger.Warn("LoadSamplesForTask: invalid HF dataset ID format", "id", hfID)
				continue
			}
			repoID, config, split := parts[0], parts[1], parts[2]
			
			// Get all rows (max 10000)
			listResult := samples.GetHfDatasetRows(repoID, config, split, 0, 10000)
			rows, ok := listResult.Items.([]samples.HfDataRow)
			if !ok {
				continue
			}
			
			for _, row := range rows {
				// Try to extract prompt field from row.Data
				prompt := ""
				if p, ok := row.Data["prompt"].(string); ok {
					prompt = p
				} else if p, ok := row.Data["text"].(string); ok {
					prompt = p
				} else if p, ok := row.Data["content"].(string); ok {
					prompt = p
				} else if p, ok := row.Data["instruction"].(string); ok {
					prompt = p
				}
				if prompt != "" {
					result = append(result, scanner.Sample{
						ID:     fmt.Sprintf("%s:%d", hfID, row.ID),
						Prompt: prompt,
						Meta: map[string]any{
							"source":    "hfdataset",
							"datasetId": hfID,
							"rowIndex":  row.ID,
						},
					})
				}
			}
		}
	}

	logger.Info("LoadSamplesForTask", "taskID", taskID, "count", len(result))
	return result, nil
}
