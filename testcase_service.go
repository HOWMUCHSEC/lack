package main

import (
	"encoding/json"
	"fmt"
	"time"

	"lack-client/pkg/logger"
	"lack-client/pkg/storage"

	badger "github.com/dgraph-io/badger/v4"
)

const (
	prefixTestCase = "testcase:"
	prefixVariable = "variable:"
)

// TestCase represents a test case.
type TestCase struct {
	ID               string   `json:"id"`
	Category         string   `json:"category"`
	Title            string   `json:"title"`
	Content          string   `json:"content"`
	ExpectedResponse string   `json:"expectedResponse,omitempty"`
	Severity         string   `json:"severity"`
	Status           string   `json:"status"`
	Tags             []string `json:"tags,omitempty"`
	CreatedAt        int64    `json:"createdAt"`
	UpdatedAt        int64    `json:"updatedAt"`
}

// UserVariable represents a user-defined variable.
type UserVariable struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Value       string `json:"value"` // JSON array or plain text
	Enabled     bool   `json:"enabled"`
	Description string `json:"description,omitempty"`
	CreatedAt   int64  `json:"createdAt"`
	UpdatedAt   int64  `json:"updatedAt"`
}

// ListResult represents a paginated list result.
type ListResult struct {
	Items   interface{} `json:"items"`
	Total   int         `json:"total"`
	HasMore bool        `json:"hasMore"`
}

// TestCaseService provides test case and variable management services.
type TestCaseService struct{}

// NewTestCaseService creates a new TestCaseService instance.
func NewTestCaseService() *TestCaseService {
	return &TestCaseService{}
}

// ========== TestCase CRUD ==========

// ListTestCases lists all test cases.
func (s *TestCaseService) ListTestCases(offset, limit int) ListResult {
	if limit <= 0 {
		limit = 50
	}

	items, err := storage.ListByPrefix([]byte(prefixTestCase), offset, limit+1)
	if err != nil {
		logger.Error("ListTestCases error", "error", err)
		return ListResult{Items: []TestCase{}, Total: 0}
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}

	testCases := make([]TestCase, 0, len(items))
	for _, item := range items {
		var tc TestCase
		if err := json.Unmarshal(item.Value, &tc); err == nil {
			testCases = append(testCases, tc)
		}
	}

	total, _ := storage.CountByPrefix([]byte(prefixTestCase))

	return ListResult{
		Items:   testCases,
		Total:   total,
		HasMore: hasMore,
	}
}

// GetTestCase retrieves a single test case by ID.
func (s *TestCaseService) GetTestCase(id string) (*TestCase, error) {
	key := []byte(prefixTestCase + id)
	data, err := storage.Get(key)
	if err != nil {
		if err == badger.ErrKeyNotFound {
			return nil, fmt.Errorf("test case not found: %s", id)
		}
		return nil, err
	}

	var tc TestCase
	if err := json.Unmarshal(data, &tc); err != nil {
		return nil, err
	}
	return &tc, nil
}

// CreateTestCase creates a new test case.
func (s *TestCaseService) CreateTestCase(tc TestCase) (*TestCase, error) {
	now := time.Now().UnixMilli()

	// 生成ID
	if tc.ID == "" {
		tc.ID = fmt.Sprintf("tc-%d", now)
	}
	tc.CreatedAt = now
	tc.UpdatedAt = now

	// 默认状态
	if tc.Status == "" {
		tc.Status = "active"
	}

	data, err := json.Marshal(tc)
	if err != nil {
		return nil, fmt.Errorf("marshal error: %w", err)
	}

	key := []byte(prefixTestCase + tc.ID)
	if err := storage.Put(key, data); err != nil {
		return nil, fmt.Errorf("storage error: %w", err)
	}

	logger.Info("CreateTestCase success", "id", tc.ID, "title", tc.Title)
	return &tc, nil
}

// UpdateTestCase updates an existing test case.
func (s *TestCaseService) UpdateTestCase(tc TestCase) (*TestCase, error) {
	if tc.ID == "" {
		return nil, fmt.Errorf("id is required")
	}

	// 检查是否存在
	existing, err := s.GetTestCase(tc.ID)
	if err != nil {
		return nil, err
	}

	// 保留创建时间，更新修改时间
	tc.CreatedAt = existing.CreatedAt
	tc.UpdatedAt = time.Now().UnixMilli()

	data, err := json.Marshal(tc)
	if err != nil {
		return nil, fmt.Errorf("marshal error: %w", err)
	}

	key := []byte(prefixTestCase + tc.ID)
	if err := storage.Put(key, data); err != nil {
		return nil, fmt.Errorf("storage error: %w", err)
	}

	logger.Info("UpdateTestCase success", "id", tc.ID)
	return &tc, nil
}

// DeleteTestCase deletes a test case by ID.
func (s *TestCaseService) DeleteTestCase(id string) error {
	if id == "" {
		return fmt.Errorf("id is required")
	}

	key := []byte(prefixTestCase + id)
	if err := storage.Delete(key); err != nil {
		if err == badger.ErrKeyNotFound {
			return nil // 已删除，视为成功
		}
		return fmt.Errorf("delete error: %w", err)
	}

	logger.Info("DeleteTestCase success", "id", id)
	return nil
}

// ========== UserVariable CRUD ==========

// ListVariables lists all user variables.
func (s *TestCaseService) ListVariables(offset, limit int) ListResult {
	if limit <= 0 {
		limit = 50
	}

	items, err := storage.ListByPrefix([]byte(prefixVariable), offset, limit+1)
	if err != nil {
		logger.Error("ListVariables error", "error", err)
		return ListResult{Items: []UserVariable{}, Total: 0}
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}

	variables := make([]UserVariable, 0, len(items))
	for _, item := range items {
		var v UserVariable
		if err := json.Unmarshal(item.Value, &v); err == nil {
			variables = append(variables, v)
		}
	}

	total, _ := storage.CountByPrefix([]byte(prefixVariable))

	return ListResult{
		Items:   variables,
		Total:   total,
		HasMore: hasMore,
	}
}

// GetVariable retrieves a single variable by ID.
func (s *TestCaseService) GetVariable(id string) (*UserVariable, error) {
	key := []byte(prefixVariable + id)
	data, err := storage.Get(key)
	if err != nil {
		if err == badger.ErrKeyNotFound {
			return nil, fmt.Errorf("variable not found: %s", id)
		}
		return nil, err
	}

	var v UserVariable
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// CreateVariable creates a new user variable.
func (s *TestCaseService) CreateVariable(v UserVariable) (*UserVariable, error) {
	now := time.Now().UnixMilli()

	// 生成ID
	if v.ID == "" {
		v.ID = fmt.Sprintf("var-%d", now)
	}
	v.CreatedAt = now
	v.UpdatedAt = now

	data, err := json.Marshal(v)
	if err != nil {
		return nil, fmt.Errorf("marshal error: %w", err)
	}

	key := []byte(prefixVariable + v.ID)
	if err := storage.Put(key, data); err != nil {
		return nil, fmt.Errorf("storage error: %w", err)
	}

	logger.Info("CreateVariable success", "id", v.ID, "name", v.Name)
	return &v, nil
}

// UpdateVariable updates an existing user variable.
func (s *TestCaseService) UpdateVariable(v UserVariable) (*UserVariable, error) {
	if v.ID == "" {
		return nil, fmt.Errorf("id is required")
	}

	// 检查是否存在
	existing, err := s.GetVariable(v.ID)
	if err != nil {
		return nil, err
	}

	// 保留创建时间，更新修改时间
	v.CreatedAt = existing.CreatedAt
	v.UpdatedAt = time.Now().UnixMilli()

	data, err := json.Marshal(v)
	if err != nil {
		return nil, fmt.Errorf("marshal error: %w", err)
	}

	key := []byte(prefixVariable + v.ID)
	if err := storage.Put(key, data); err != nil {
		return nil, fmt.Errorf("storage error: %w", err)
	}

	logger.Info("UpdateVariable success", "id", v.ID)
	return &v, nil
}

// DeleteVariable deletes a user variable by ID.
func (s *TestCaseService) DeleteVariable(id string) error {
	if id == "" {
		return fmt.Errorf("id is required")
	}

	key := []byte(prefixVariable + id)
	if err := storage.Delete(key); err != nil {
		if err == badger.ErrKeyNotFound {
			return nil // 已删除，视为成功
		}
		return fmt.Errorf("delete error: %w", err)
	}

	logger.Info("DeleteVariable success", "id", id)
	return nil
}

// ToggleTestCaseStatus toggles the active status of a test case.
func (s *TestCaseService) ToggleTestCaseStatus(id string) (*TestCase, error) {
	tc, err := s.GetTestCase(id)
	if err != nil {
		return nil, err
	}

	if tc.Status == "active" {
		tc.Status = "inactive"
	} else {
		tc.Status = "active"
	}

	return s.UpdateTestCase(*tc)
}

// ToggleVariableEnabled toggles the enabled status of a variable.
func (s *TestCaseService) ToggleVariableEnabled(id string) (*UserVariable, error) {
	v, err := s.GetVariable(id)
	if err != nil {
		return nil, err
	}

	v.Enabled = !v.Enabled

	return s.UpdateVariable(*v)
}

// CopyTestCase creates a copy of an existing test case.
func (s *TestCaseService) CopyTestCase(id string) (*TestCase, error) {
	tc, err := s.GetTestCase(id)
	if err != nil {
		return nil, err
	}

	// 创建副本
	newTC := TestCase{
		Category:         tc.Category,
		Title:            tc.Title + " (Copy)",
		Content:          tc.Content,
		ExpectedResponse: tc.ExpectedResponse,
		Severity:         tc.Severity,
		Status:           "inactive",
		Tags:             tc.Tags,
	}

	return s.CreateTestCase(newTC)
}
