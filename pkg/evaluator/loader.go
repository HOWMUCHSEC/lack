package evaluator

import (
	"encoding/json"
	"fmt"

	"lack-client/pkg/logger"
	"lack-client/pkg/storage"
)

const (
	MaxEvalLoadedItems = 10000
)

// Storage prefix constants
const (
	prefixSample    = "sample:"
	prefixSampleSet = "sampleset:"
	prefixHfData    = "hfdata:"
	prefixCloudSet  = "sets:"
)

// LoadLocalSamples loads samples from local sample sets.
func LoadLocalSamples(setIDs []string) ([]NormalizedItem, error) {
	return LoadLocalSamplesLimited(setIDs, 0)
}

func LoadLocalSamplesLimited(setIDs []string, limit int) ([]NormalizedItem, error) {
	var result []NormalizedItem

	for _, setID := range setIDs {
		remaining := remainingLimit(limit, len(result))
		if limit > 0 && remaining <= 0 {
			break
		}

		prefix := []byte(prefixSample + setID + "-")
		items, err := storage.ListByPrefix(prefix, 0, remaining)
		if err != nil {
			logger.Warn("LoadLocalSamples list error", "setID", setID, "error", err)
			continue
		}

		for _, item := range items {
			var sample struct {
				ID               string   `json:"id"`
				GeneratedContent string   `json:"generatedContent"`
				Category         string   `json:"category"`
				Severity         string   `json:"severity"`
				Tags             []string `json:"tags"`
			}

			if err := json.Unmarshal(item.Value, &sample); err != nil {
				logger.Warn("LoadLocalSamples unmarshal error", "key", string(item.Key), "error", err)
				continue
			}

			result = append(result, NormalizedItem{
				SourceType: "local",
				SourceID:   sample.ID,
				Data: map[string]any{
					"prompt":   sample.GeneratedContent,
					"category": sample.Category,
					"severity": sample.Severity,
					"tags":     sample.Tags,
				},
			})
		}

		logger.Debug("LoadLocalSamples loaded set", "setID", setID, "count", len(items))
	}

	return result, nil
}

// LoadCloudSamples loads samples from downloaded cloud samples.
func LoadCloudSamples(setIDs []string) ([]NormalizedItem, error) {
	return LoadCloudSamplesLimited(setIDs, 0)
}

func LoadCloudSamplesLimited(setIDs []string, limit int) ([]NormalizedItem, error) {
	var result []NormalizedItem

	for _, id := range setIDs {
		if limit > 0 && len(result) >= limit {
			break
		}

		key := []byte(prefixCloudSet + id)
		data, err := storage.Get(key)
		if err != nil {
			logger.Warn("LoadCloudSamples get error", "id", id, "error", err)
			continue
		}

		var cloudSet struct {
			ID             string `json:"id"`
			LabelLv1       string `json:"label_lv1"`
			LabelLv2       string `json:"label_lv2"`
			PromptText     string `json:"prompt_text"`
			ExpectedOutput string `json:"expected_output"`
		}

		if err := json.Unmarshal(data, &cloudSet); err != nil {
			logger.Warn("LoadCloudSamples unmarshal error", "id", id, "error", err)
			continue
		}

		result = append(result, NormalizedItem{
			SourceType: "cloud",
			SourceID:   id,
			Data: map[string]any{
				"prompt":            cloudSet.PromptText,
				"category":          cloudSet.LabelLv1,
				"sub_category":      cloudSet.LabelLv2,
				"expected_behavior": cloudSet.ExpectedOutput,
			},
		})
	}

	logger.Debug("LoadCloudSamples loaded", "count", len(result))
	return result, nil
}

// LoadHfDatasetRows loads data rows from downloaded HF datasets.
func LoadHfDatasetRows(ref HfDatasetRef) ([]NormalizedItem, error) {
	return LoadHfDatasetRowsLimited(ref, 0)
}

func LoadHfDatasetRowsLimited(ref HfDatasetRef, limit int) ([]NormalizedItem, error) {
	prefix := []byte(fmt.Sprintf("%s%s:%s:%s:", prefixHfData, ref.RepoID, ref.Config, ref.Split))
	items, err := storage.ListByPrefix(prefix, 0, limit)
	if err != nil {
		return nil, fmt.Errorf("list HF data error: %w", err)
	}

	var result []NormalizedItem

	for _, item := range items {
		var row struct {
			ID          int            `json:"id"`
			SourceIndex int            `json:"sourceIndex"`
			Data        map[string]any `json:"data"`
		}

		if err := json.Unmarshal(item.Value, &row); err != nil {
			logger.Warn("LoadHfDatasetRows unmarshal error", "key", string(item.Key), "error", err)
			continue
		}

		result = append(result, NormalizedItem{
			SourceType: "hf",
			SourceID:   fmt.Sprintf("%s:%s:%s:%d", ref.RepoID, ref.Config, ref.Split, row.SourceIndex),
			Data:       row.Data,
		})
	}

	logger.Debug("LoadHfDatasetRows loaded", "repoID", ref.RepoID, "count", len(result))
	return result, nil
}

// ApplyFieldMapping applies field mapping, converting raw dataset fields to standard fields.
func ApplyFieldMapping(data map[string]any, mapping map[string]string) map[string]any {
	if len(mapping) == 0 {
		return data
	}

	result := make(map[string]any)

	// Copy original data first
	for k, v := range data {
		result[k] = v
	}

	// Apply mapping
	for srcField, dstField := range mapping {
		if val, ok := data[srcField]; ok {
			result[dstField] = val
		}
	}

	return result
}

// LoadAllDatasets loads data from all data sources.
func LoadAllDatasets(config DatasetConfig, template *EvaluatorTemplate) ([]NormalizedItem, error) {
	return LoadAllDatasetsLimited(config, template, MaxEvalLoadedItems)
}

func LoadAllDatasetsLimited(config DatasetConfig, template *EvaluatorTemplate, limit int) ([]NormalizedItem, error) {
	var allItems []NormalizedItem

	// 1. Load local sample sets
	if len(config.LocalSampleSetIDs) > 0 {
		items, err := LoadLocalSamplesLimited(config.LocalSampleSetIDs, remainingLimit(limit, len(allItems)))
		if err != nil {
			logger.Warn("LoadAllDatasets local error", "error", err)
		} else {
			allItems = append(allItems, items...)
		}
	}

	// 2. Load downloaded cloud samples
	if len(config.CloudSampleSetIDs) > 0 && (limit <= 0 || len(allItems) < limit) {
		items, err := LoadCloudSamplesLimited(config.CloudSampleSetIDs, remainingLimit(limit, len(allItems)))
		if err != nil {
			logger.Warn("LoadAllDatasets cloud error", "error", err)
		} else {
			allItems = append(allItems, items...)
		}
	}

	// 3. Load HF datasets
	for _, hfRef := range config.HfDatasets {
		remaining := remainingLimit(limit, len(allItems))
		if limit > 0 && remaining <= 0 {
			break
		}

		items, err := LoadHfDatasetRowsLimited(hfRef, remaining)
		if err != nil {
			logger.Warn("LoadAllDatasets HF error", "repoID", hfRef.RepoID, "error", err)
			continue
		}

		// Apply field mapping
		if template != nil && template.FieldMappings != nil {
			if mapping, ok := template.FieldMappings[hfRef.RepoID]; ok {
				for i := range items {
					items[i].Data = ApplyFieldMapping(items[i].Data, mapping)
				}
			}
		}

		allItems = append(allItems, items...)
	}

	logger.Info("LoadAllDatasets complete",
		"localCount", len(config.LocalSampleSetIDs),
		"cloudCount", len(config.CloudSampleSetIDs),
		"hfCount", len(config.HfDatasets),
		"totalItems", len(allItems))

	return allItems, nil
}

func remainingLimit(limit, current int) int {
	if limit <= 0 {
		return 0
	}
	remaining := limit - current
	if remaining < 0 {
		return 0
	}
	return remaining
}

// ValidateDatasetConfig validates dataset configuration, ensuring all data sources are downloaded locally.
func ValidateDatasetConfig(config DatasetConfig) error {
	// Check local sample sets
	for _, setID := range config.LocalSampleSetIDs {
		key := []byte(prefixSampleSet + setID)
		if _, err := storage.Get(key); err != nil {
			return fmt.Errorf("local sample set not found: %s", setID)
		}
	}

	// Check cloud samples
	for _, id := range config.CloudSampleSetIDs {
		key := []byte(prefixCloudSet + id)
		if _, err := storage.Get(key); err != nil {
			return fmt.Errorf("cloud sample not downloaded: %s", id)
		}
	}

	// Check HF datasets
	for _, hfRef := range config.HfDatasets {
		metaKey := []byte(fmt.Sprintf("hfdataset:%s:%s:%s", hfRef.RepoID, hfRef.Config, hfRef.Split))
		if _, err := storage.Get(metaKey); err != nil {
			return fmt.Errorf("HF dataset not downloaded: %s (config=%s, split=%s)", hfRef.RepoID, hfRef.Config, hfRef.Split)
		}
	}

	return nil
}

// CountDatasetItems counts the total number of items in the dataset configuration.
func CountDatasetItems(config DatasetConfig) (int, error) {
	total := 0

	// Count local sample sets
	for _, setID := range config.LocalSampleSetIDs {
		prefix := []byte(prefixSample + setID + "-")
		count, err := storage.CountByPrefix(prefix)
		if err != nil {
			logger.Warn("CountDatasetItems local error", "setID", setID, "error", err)
			continue
		}
		total += count
	}

	// Count cloud samples
	total += len(config.CloudSampleSetIDs)

	// Count HF datasets
	for _, hfRef := range config.HfDatasets {
		prefix := []byte(fmt.Sprintf("%s%s:%s:%s:", prefixHfData, hfRef.RepoID, hfRef.Config, hfRef.Split))
		count, err := storage.CountByPrefix(prefix)
		if err != nil {
			logger.Warn("CountDatasetItems HF error", "repoID", hfRef.RepoID, "error", err)
			continue
		}
		total += count
	}

	return total, nil
}
