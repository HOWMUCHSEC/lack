package samples

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"lack-client/pkg/logger"
	"lack-client/pkg/storage"
	"lack-client/pkg/utils"
)

// Sample represents a generated sample.
type Sample struct {
	ID               string            `json:"id"`
	TestCaseID       string            `json:"testCaseId"`
	TestCaseTitle    string            `json:"testCaseTitle"`
	OriginalContent  string            `json:"originalContent"`
	GeneratedContent string            `json:"generatedContent"`
	Variables        map[string]string `json:"variables"`
	Category         string            `json:"category"`
	Severity         string            `json:"severity"`
	Tags             []string          `json:"tags,omitempty"`
	CreatedAt        int64             `json:"createdAt"`
}

// SampleSet represents a set of samples.
type SampleSet struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	TestCaseIDs []string `json:"testCaseIds"`
	SampleCount int      `json:"sampleCount"`
	CreatedAt   int64    `json:"createdAt"`
	UpdatedAt   int64    `json:"updatedAt"`
}

// Variable represents a user variable.
type Variable struct {
	Name    string   `json:"name"`
	Values  []string `json:"values"`
	Enabled bool     `json:"enabled"`
}

// GenerateRequest represents a request to generate samples.
type GenerateRequest struct {
	TestCaseID     string     `json:"testCaseId"`
	TestCaseTitle  string     `json:"testCaseTitle"`
	Content        string     `json:"content"`
	Category       string     `json:"category"`
	Severity       string     `json:"severity"`
	Tags           []string   `json:"tags,omitempty"`
	Variables      []Variable `json:"variables"`
	SetName        string     `json:"setName,omitempty"`
	SetDescription string     `json:"setDescription,omitempty"`
}

// GenerateResult represents the generation result.
type GenerateResult struct {
	Success     bool     `json:"success"`
	SetID       string   `json:"setId,omitempty"`
	SampleCount int      `json:"sampleCount"`
	SampleIDs   []string `json:"sampleIds,omitempty"`
	Error       string   `json:"error,omitempty"`
}

// ListResult represents the list query result.
type ListResult struct {
	Items   interface{} `json:"items"`
	Total   int         `json:"total"`
	HasMore bool        `json:"hasMore"`
}

const (
	prefixSample    = "sample:"
	prefixSampleSet = "sampleset:"
	prefixHfDataset = "hfdataset:"
	prefixHfData    = "hfdata:"
	prefixPrompt    = "prompts:"

	maxSampleCombinations = 10000
)

var sampleStore = storage.DefaultStore()

// CommunityPrompt represents a downloaded community prompt (subset of fields).
type CommunityPrompt struct {
	ID             int64  `json:"id"`
	LabelLv1       string `json:"labelLv1"`
	LabelLv2       string `json:"labelLv2"`
	PromptText     string `json:"promptText"`
	ExpectedOutput string `json:"expectedOutput,omitempty"`
	PromptHash     string `json:"promptHash"`
	DownloadedAt   int64  `json:"downloadedAt"`
}

// cartesianProduct calculates the Cartesian product of variable values.
// Input: []Variable{{"a", ["1","2"]}, {"b", ["x","y"]}}
// Output: []map[string]string{{"a":"1","b":"x"}, {"a":"1","b":"y"}, {"a":"2","b":"x"}, {"a":"2","b":"y"}}
func cartesianProduct(vars []Variable) ([]map[string]string, error) {
	if len(vars) == 0 {
		return []map[string]string{{}}, nil
	}

	// Filter disabled variables and empty values
	activeVars := make([]Variable, 0)
	for _, v := range vars {
		if v.Enabled && len(v.Values) > 0 {
			activeVars = append(activeVars, v)
		}
	}

	if len(activeVars) == 0 {
		return []map[string]string{{}}, nil
	}

	total := 1
	for _, v := range activeVars {
		if len(v.Values) > maxSampleCombinations/total {
			return nil, fmt.Errorf("sample combination count exceeds limit of %d", maxSampleCombinations)
		}
		total *= len(v.Values)
	}

	result := []map[string]string{{}}
	for _, v := range activeVars {
		newResult := make([]map[string]string, 0, len(result)*len(v.Values))
		for _, combo := range result {
			for _, val := range v.Values {
				newCombo := make(map[string]string)
				for k, vv := range combo {
					newCombo[k] = vv
				}
				newCombo[v.Name] = val
				newResult = append(newResult, newCombo)
			}
		}
		result = newResult
	}
	return result, nil
}

// GenerateSamples generates and stores all samples based on test case and variables.
func GenerateSamples(req GenerateRequest) GenerateResult {
	if req.Content == "" {
		return GenerateResult{Success: false, Error: "content is empty"}
	}

	// Generate Cartesian product
	combos, err := cartesianProduct(req.Variables)
	if err != nil {
		return GenerateResult{Success: false, Error: err.Error()}
	}
	if len(combos) == 0 {
		combos = []map[string]string{{}}
	}

	now := time.Now().UnixMilli()
	setID := fmt.Sprintf("set-%d", now)
	sampleIDs := make([]string, 0, len(combos))
	const batchSize = 200
	batch := make([]storage.BatchItem, 0, batchSize)

	for i, combo := range combos {
		sampleID := fmt.Sprintf("%s-%d", setID, i)
		generatedContent := utils.Interpolate(req.Content, combo)

		sample := Sample{
			ID:               sampleID,
			TestCaseID:       req.TestCaseID,
			TestCaseTitle:    req.TestCaseTitle,
			OriginalContent:  req.Content,
			GeneratedContent: generatedContent,
			Variables:        combo,
			Category:         req.Category,
			Severity:         req.Severity,
			Tags:             req.Tags,
			CreatedAt:        now,
		}

		data, err := json.Marshal(sample)
		if err != nil {
			return GenerateResult{Success: false, Error: fmt.Sprintf("marshal sample error: %v", err)}
		}

		key := []byte(prefixSample + sampleID)
		batch = append(batch, storage.BatchItem{Key: key, Value: data})
		sampleIDs = append(sampleIDs, sampleID)

		if len(batch) >= batchSize {
			if err := sampleStore.PutBatch(batch); err != nil {
				return GenerateResult{Success: false, Error: fmt.Sprintf("store sample error: %v", err)}
			}
			batch = batch[:0]
		}
	}

	if len(batch) > 0 {
		if err := sampleStore.PutBatch(batch); err != nil {
			return GenerateResult{Success: false, Error: fmt.Sprintf("store sample error: %v", err)}
		}
	}

	// Create sample set record
	setName := req.SetName
	if setName == "" {
		setName = fmt.Sprintf("Generated - %s", req.TestCaseTitle)
	}

	sampleSet := SampleSet{
		ID:          setID,
		Name:        setName,
		Description: req.SetDescription,
		TestCaseIDs: []string{req.TestCaseID},
		SampleCount: len(sampleIDs),
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	setData, err := json.Marshal(sampleSet)
	if err != nil {
		return GenerateResult{Success: false, Error: fmt.Sprintf("marshal set error: %v", err)}
	}

	setKey := []byte(prefixSampleSet + setID)
	if err := sampleStore.Put(setKey, setData); err != nil {
		return GenerateResult{Success: false, Error: fmt.Sprintf("store set error: %v", err)}
	}

	return GenerateResult{
		Success:     true,
		SetID:       setID,
		SampleCount: len(sampleIDs),
		SampleIDs:   sampleIDs,
	}
}

// ListSampleSets lists all sample sets.
func ListSampleSets(offset, limit int) ListResult {
	if limit <= 0 {
		limit = 50
	}

	items, err := storage.ListByPrefix([]byte(prefixSampleSet), offset, limit+1)
	if err != nil {
		return ListResult{Items: []SampleSet{}, Total: 0}
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}

	sets := make([]SampleSet, 0, len(items))
	for _, item := range items {
		var set SampleSet
		if err := json.Unmarshal(item.Value, &set); err == nil {
			sets = append(sets, set)
		}
	}

	total, _ := storage.CountByPrefix([]byte(prefixSampleSet))

	return ListResult{
		Items:   sets,
		Total:   total,
		HasMore: hasMore,
	}
}

// SearchSampleSets searches sample sets by query string (name or description).
// Performs case-insensitive substring matching in memory.
func SearchSampleSets(query string, offset, limit int) ListResult {
	if limit <= 0 {
		limit = 50
	}

	// Load all sample sets (no prefix filtering)
	allItems, err := storage.ListByPrefix([]byte(prefixSampleSet), 0, 0)
	if err != nil {
		logger.Error("SearchSampleSets: failed to list", "error", err)
		return ListResult{Items: []SampleSet{}, Total: 0}
	}

	// Filter by query (preallocate capacity to avoid reallocation)
	matched := make([]SampleSet, 0, len(allItems))
	queryLower := strings.ToLower(query)

	for _, item := range allItems {
		var set SampleSet
		if err := json.Unmarshal(item.Value, &set); err == nil {
			// If no query, include all
			if query == "" {
				matched = append(matched, set)
				continue
			}

			// Case-insensitive substring match on name or description
			if strings.Contains(strings.ToLower(set.Name), queryLower) ||
				strings.Contains(strings.ToLower(set.Description), queryLower) {
				matched = append(matched, set)
			}
		}
	}

	// Apply pagination
	total := len(matched)
	start := offset
	if start > total {
		start = total
	}
	end := start + limit
	if end > total {
		end = total
	}

	results := matched[start:end]
	hasMore := end < total

	return ListResult{
		Items:   results,
		Total:   total,
		HasMore: hasMore,
	}
}

// ListSamplesBySet lists all samples in a sample set.
func ListSamplesBySet(setID string, offset, limit int) ListResult {
	if limit <= 0 {
		limit = 100
	}

	prefix := []byte(prefixSample + setID + "-")
	items, err := storage.ListByPrefix(prefix, offset, limit+1)
	if err != nil {
		return ListResult{Items: []Sample{}, Total: 0}
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}

	samples := make([]Sample, 0, len(items))
	for _, item := range items {
		var s Sample
		if err := json.Unmarshal(item.Value, &s); err == nil {
			samples = append(samples, s)
		}
	}

	total, _ := storage.CountByPrefix(prefix)

	return ListResult{
		Items:   samples,
		Total:   total,
		HasMore: hasMore,
	}
}

// GetSample retrieves a single sample.
func GetSample(sampleID string) (*Sample, error) {
	key := []byte(prefixSample + sampleID)
	data, err := storage.Get(key)
	if err != nil {
		return nil, err
	}

	var s Sample
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, err
	}
	return &s, nil
}

// GetSampleSet retrieves a single sample set.
func GetSampleSet(setID string) (*SampleSet, error) {
	key := []byte(prefixSampleSet + setID)
	data, err := storage.Get(key)
	if err != nil {
		return nil, err
	}

	var set SampleSet
	if err := json.Unmarshal(data, &set); err != nil {
		return nil, err
	}
	return &set, nil
}

// DeleteSampleSet deletes a sample set and all its samples.
func DeleteSampleSet(setID string) error {
	// Batch delete all samples
	prefix := []byte(prefixSample + setID + "-")
	items, err := storage.ListByPrefix(prefix, 0, 0)
	if err != nil {
		return err
	}

	if len(items) > 0 {
		keys := make([][]byte, len(items))
		for i, item := range items {
			keys[i] = item.Key
		}
		if err := storage.DeleteBatch(keys); err != nil {
			return err
		}
	}

	// Delete sample set
	setKey := []byte(prefixSampleSet + setID)
	return storage.Delete(setKey)
}

// DeleteSample deletes a single sample and updates sample set count.
func DeleteSample(sampleID string) error {
	logger.Debug("DeleteSample called", "sampleID", sampleID)

	key := []byte(prefixSample + sampleID)
	if err := storage.Delete(key); err != nil {
		logger.Error("DeleteSample delete error", "sampleID", sampleID, "error", err)
		return err
	}

	// Extract setID from sampleID (format: set-{timestamp}-{index})
	// Find last "-" position, prefix is setID
	lastDash := -1
	for i := len(sampleID) - 1; i >= 0; i-- {
		if sampleID[i] == '-' {
			lastDash = i
			break
		}
	}

	if lastDash > 0 {
		setID := sampleID[:lastDash]
		logger.Debug("DeleteSample extracted setID", "sampleID", sampleID, "setID", setID)

		// Get and update sample set
		set, err := GetSampleSet(setID)
		if err != nil {
			logger.Warn("DeleteSample GetSampleSet error", "setID", setID, "error", err)
		} else if set != nil {
			oldCount := set.SampleCount
			set.SampleCount--
			if set.SampleCount < 0 {
				set.SampleCount = 0
			}
			set.UpdatedAt = time.Now().UnixMilli()

			// Save updated sample set
			setData, err := json.Marshal(set)
			if err != nil {
				logger.Error("DeleteSample marshal error", "setID", setID, "error", err)
			} else {
				setKey := []byte(prefixSampleSet + setID)
				if err := storage.Put(setKey, setData); err != nil {
					logger.Error("DeleteSample put error", "setID", setID, "error", err)
				} else {
					logger.Info("DeleteSample updated sampleCount",
						"setID", setID,
						"oldCount", oldCount,
						"newCount", set.SampleCount)
				}
			}
		}
	}

	return nil
}

// ============== HF Public Datasets ==============

// HfDatasetMeta represents downloaded HF dataset metadata.
type HfDatasetMeta struct {
	HfRepoID     string `json:"hfRepoId"`
	Config       string `json:"config"`
	Split        string `json:"split"`
	RowCount     int    `json:"rowCount"`
	DownloadedAt int64  `json:"downloadedAt"`
	UpdatedAt    int64  `json:"updatedAt"`
}

// HfDataRow represents a row in HF dataset.
type HfDataRow struct {
	ID            int                    `json:"id"`
	HfRepoID      string                 `json:"hfRepoId"`
	Config        string                 `json:"config"`
	Split         string                 `json:"split"`
	SourceIndex   int                    `json:"sourceIndex"`
	Data          map[string]interface{} `json:"data"`
	Checksum      string                 `json:"checksum,omitempty"`
	ImportedAt    string                 `json:"importedAt"`
	UpdatedAt     string                 `json:"updatedAt"`
	Status        string                 `json:"status"`
	ExtraMetadata map[string]interface{} `json:"extraMetadata,omitempty"`
}

// makeHfDatasetKey generates storage key for dataset metadata.
func makeHfDatasetKey(repoID, config, split string) []byte {
	return []byte(fmt.Sprintf("%s%s:%s:%s", prefixHfDataset, repoID, config, split))
}

// makeHfDataKey generates storage key for data row.
func makeHfDataKey(repoID, config, split string, index int) []byte {
	return []byte(fmt.Sprintf("%s%s:%s:%s:%d", prefixHfData, repoID, config, split, index))
}

// makeHfDataPrefix generates prefix for data rows (for iteration).
func makeHfDataPrefix(repoID, config, split string) []byte {
	return []byte(fmt.Sprintf("%s%s:%s:%s:", prefixHfData, repoID, config, split))
}

// SaveHfDataset saves HF dataset to local storage.
func SaveHfDataset(meta HfDatasetMeta, rows []HfDataRow) error {
	now := time.Now().UnixMilli()
	meta.DownloadedAt = now
	meta.UpdatedAt = now
	meta.RowCount = len(rows)

	metaKey := makeHfDatasetKey(meta.HfRepoID, meta.Config, meta.Split)
	metaData, err := json.Marshal(meta)
	if err != nil {
		return fmt.Errorf("marshal meta error: %w", err)
	}

	// Marshal all rows before touching existing storage so invalid data cannot
	// leave a partially overwritten dataset behind.
	const batchSize = 100
	allRowItems := make([]storage.BatchItem, 0, len(rows))
	allRowKeys := make([][]byte, 0, len(rows))
	for i, row := range rows {
		rowKey := makeHfDataKey(meta.HfRepoID, meta.Config, meta.Split, i)
		rowData, err := json.Marshal(row)
		if err != nil {
			return fmt.Errorf("marshal row %d error: %w", i, err)
		}
		allRowItems = append(allRowItems, storage.BatchItem{Key: rowKey, Value: rowData})
		allRowKeys = append(allRowKeys, rowKey)
	}

	// Remove old rows and metadata first. Metadata is written last, so callers
	// never see a successful dataset record unless all rows were stored.
	oldItems, err := sampleStore.ListByPrefix(makeHfDataPrefix(meta.HfRepoID, meta.Config, meta.Split), 0, 0)
	if err != nil {
		return fmt.Errorf("list old rows error: %w", err)
	}
	if len(oldItems) > 0 {
		oldKeys := make([][]byte, len(oldItems))
		for i, item := range oldItems {
			oldKeys[i] = item.Key
		}
		if err := sampleStore.DeleteBatch(oldKeys); err != nil {
			return fmt.Errorf("delete old rows error: %w", err)
		}
	}
	if err := sampleStore.Delete(metaKey); err != nil {
		return fmt.Errorf("delete old meta error: %w", err)
	}

	for start := 0; start < len(allRowItems); start += batchSize {
		end := start + batchSize
		if end > len(allRowItems) {
			end = len(allRowItems)
		}
		batch := allRowItems[start:end]
		if err := sampleStore.PutBatch(batch); err != nil {
			_ = sampleStore.DeleteBatch(allRowKeys)
			return fmt.Errorf("put rows error: %w", err)
		}
	}

	if err := sampleStore.Put(metaKey, metaData); err != nil {
		_ = sampleStore.DeleteBatch(allRowKeys)
		return fmt.Errorf("put meta error: %w", err)
	}

	logger.Info("SaveHfDataset success",
		"repoId", meta.HfRepoID,
		"config", meta.Config,
		"split", meta.Split,
		"rowCount", len(rows))

	return nil
}

// ListDownloadedHfDatasets lists all downloaded HF datasets.
func ListDownloadedHfDatasets() ([]HfDatasetMeta, error) {
	items, err := storage.ListByPrefix([]byte(prefixHfDataset), 0, 0)
	if err != nil {
		return nil, err
	}

	datasets := make([]HfDatasetMeta, 0, len(items))
	for _, item := range items {
		var meta HfDatasetMeta
		if err := json.Unmarshal(item.Value, &meta); err == nil {
			datasets = append(datasets, meta)
		}
	}

	return datasets, nil
}

// GetHfDatasetMeta retrieves metadata for a specific HF dataset.
func GetHfDatasetMeta(repoID, config, split string) (*HfDatasetMeta, error) {
	key := makeHfDatasetKey(repoID, config, split)
	data, err := storage.Get(key)
	if err != nil {
		return nil, err
	}

	var meta HfDatasetMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, err
	}
	return &meta, nil
}

// GetHfDatasetRows retrieves rows of an HF dataset with pagination.
func GetHfDatasetRows(repoID, config, split string, offset, limit int) ListResult {
	if limit <= 0 {
		limit = 100
	}

	prefix := makeHfDataPrefix(repoID, config, split)
	items, err := storage.ListByPrefix(prefix, offset, limit+1)
	if err != nil {
		return ListResult{Items: []HfDataRow{}, Total: 0}
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}

	rows := make([]HfDataRow, 0, len(items))
	for _, item := range items {
		var row HfDataRow
		if err := json.Unmarshal(item.Value, &row); err == nil {
			rows = append(rows, row)
		}
	}

	total, _ := storage.CountByPrefix(prefix)

	return ListResult{
		Items:   rows,
		Total:   total,
		HasMore: hasMore,
	}
}

// DeleteHfDataset deletes a downloaded HF dataset.
func DeleteHfDataset(repoID, config, split string) error {
	// Batch delete all data rows
	prefix := makeHfDataPrefix(repoID, config, split)
	items, err := storage.ListByPrefix(prefix, 0, 0)
	if err != nil {
		return err
	}

	if len(items) > 0 {
		keys := make([][]byte, len(items))
		for i, item := range items {
			keys[i] = item.Key
		}
		if err := storage.DeleteBatch(keys); err != nil {
			logger.Warn("DeleteHfDataset batch delete rows error", "error", err)
		}
	}

	// Delete metadata
	metaKey := makeHfDatasetKey(repoID, config, split)
	if err := storage.Delete(metaKey); err != nil {
		return err
	}

	logger.Info("DeleteHfDataset success",
		"repoId", repoID,
		"config", config,
		"split", split,
		"rowsDeleted", len(items))

	return nil
}

// IsHfDatasetDownloaded checks if an HF dataset is downloaded.
func IsHfDatasetDownloaded(repoID, config, split string) bool {
	key := makeHfDatasetKey(repoID, config, split)
	_, err := storage.Get(key)
	return err == nil
}

// ListDownloadedCommunityPrompts lists all downloaded community prompts.
func ListDownloadedCommunityPrompts() ([]CommunityPrompt, error) {
	items, err := storage.ListByPrefix([]byte(prefixPrompt), 0, 0)
	if err != nil {
		return nil, err
	}

	prompts := make([]CommunityPrompt, 0, len(items))
	for _, item := range items {
		var prompt CommunityPrompt
		if err := json.Unmarshal(item.Value, &prompt); err == nil {
			prompts = append(prompts, prompt)
		}
	}

	return prompts, nil
}

// DeleteCommunityPrompt deletes a downloaded community prompt.
func DeleteCommunityPrompt(id int64) error {
	key := []byte(fmt.Sprintf("%s%d", prefixPrompt, id))
	return storage.Delete(key)
}
