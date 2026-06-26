package samples

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"lack-client/pkg/storage"
)

type fakeStore struct {
	data        map[string][]byte
	putBatchErr error
	putErr      error
}

func newFakeStore() *fakeStore {
	return &fakeStore{data: make(map[string][]byte)}
}

func (s *fakeStore) Get(key []byte) ([]byte, error) {
	value, ok := s.data[string(key)]
	if !ok {
		return nil, errors.New("key not found")
	}
	return append([]byte{}, value...), nil
}

func (s *fakeStore) Put(key, value []byte) error {
	if s.putErr != nil {
		return s.putErr
	}
	s.data[string(key)] = append([]byte{}, value...)
	return nil
}

func (s *fakeStore) Delete(key []byte) error {
	delete(s.data, string(key))
	return nil
}

func (s *fakeStore) ListByPrefix(prefix []byte, offset, limit int) ([]storage.KVItem, error) {
	items := make([]storage.KVItem, 0)
	skipped := 0
	for key, value := range s.data {
		if !strings.HasPrefix(key, string(prefix)) {
			continue
		}
		if offset > 0 && skipped < offset {
			skipped++
			continue
		}
		if limit > 0 && len(items) >= limit {
			break
		}
		items = append(items, storage.KVItem{
			Key:   []byte(key),
			Value: append([]byte{}, value...),
		})
	}
	return items, nil
}

func (s *fakeStore) ListKeysByPrefix(prefix []byte, offset, limit int) ([][]byte, error) {
	items, err := s.ListByPrefix(prefix, offset, limit)
	if err != nil {
		return nil, err
	}
	keys := make([][]byte, len(items))
	for i, item := range items {
		keys[i] = item.Key
	}
	return keys, nil
}

func (s *fakeStore) CountByPrefix(prefix []byte) (int, error) {
	count := 0
	for key := range s.data {
		if strings.HasPrefix(key, string(prefix)) {
			count++
		}
	}
	return count, nil
}

func (s *fakeStore) PutBatch(items []storage.BatchItem) error {
	if s.putBatchErr != nil {
		return s.putBatchErr
	}
	for _, item := range items {
		s.data[string(item.Key)] = append([]byte{}, item.Value...)
	}
	return nil
}

func (s *fakeStore) DeleteBatch(keys [][]byte) error {
	for _, key := range keys {
		delete(s.data, string(key))
	}
	return nil
}

func (s *fakeStore) DeleteByPrefix(prefix []byte) (int, error) {
	keys, err := s.ListKeysByPrefix(prefix, 0, 0)
	if err != nil {
		return 0, err
	}
	if err := s.DeleteBatch(keys); err != nil {
		return 0, err
	}
	return len(keys), nil
}

func (s *fakeStore) Close() error {
	return nil
}

func stubSampleStore(t *testing.T, store storage.KVStore) {
	t.Helper()
	orig := sampleStore
	sampleStore = store
	t.Cleanup(func() {
		sampleStore = orig
	})
}

func values(n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = string(rune('a' + i%26))
	}
	return out
}

func TestCartesianProductRejectsTooManyCombinations(t *testing.T) {
	_, err := cartesianProduct([]Variable{
		{Name: "a", Enabled: true, Values: values(101)},
		{Name: "b", Enabled: true, Values: values(100)},
	})
	if err == nil {
		t.Fatal("expected combination limit error")
	}
	if !strings.Contains(err.Error(), "exceeds limit") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestGenerateSamplesReturnsCombinationLimitError(t *testing.T) {
	result := GenerateSamples(GenerateRequest{
		TestCaseID: "case-1",
		Content:    "hello {{a}} {{b}}",
		Variables: []Variable{
			{Name: "a", Enabled: true, Values: values(101)},
			{Name: "b", Enabled: true, Values: values(100)},
		},
	})
	if result.Success {
		t.Fatal("expected generation to fail")
	}
	if !strings.Contains(result.Error, "exceeds limit") {
		t.Fatalf("unexpected error: %q", result.Error)
	}
}

func TestSaveHfDatasetRowsWriteFailureDoesNotWriteMetadata(t *testing.T) {
	store := newFakeStore()
	store.putBatchErr = errors.New("row write failed")
	stubSampleStore(t, store)

	meta := HfDatasetMeta{HfRepoID: "repo", Config: "cfg", Split: "train"}
	oldMeta, err := json.Marshal(HfDatasetMeta{HfRepoID: "repo", Config: "cfg", Split: "train", RowCount: 2})
	if err != nil {
		t.Fatalf("marshal old meta: %v", err)
	}
	store.data[string(makeHfDatasetKey("repo", "cfg", "train"))] = oldMeta
	store.data[string(makeHfDataKey("repo", "cfg", "train", 0))] = []byte(`{"id":0}`)
	store.data[string(makeHfDataKey("repo", "cfg", "train", 1))] = []byte(`{"id":1}`)

	err = SaveHfDataset(meta, []HfDataRow{{ID: 42, Data: map[string]interface{}{"prompt": "x"}}})
	if err == nil {
		t.Fatal("expected row write error")
	}
	if _, ok := store.data[string(makeHfDatasetKey("repo", "cfg", "train"))]; ok {
		t.Fatal("metadata should not remain after failed row write")
	}
	if _, ok := store.data[string(makeHfDataKey("repo", "cfg", "train", 0))]; ok {
		t.Fatal("old rows should be removed before overwrite")
	}
}

func TestSaveHfDatasetOverwriteRemovesStaleRows(t *testing.T) {
	store := newFakeStore()
	stubSampleStore(t, store)

	store.data[string(makeHfDataKey("repo", "cfg", "train", 0))] = []byte(`{"id":0}`)
	store.data[string(makeHfDataKey("repo", "cfg", "train", 1))] = []byte(`{"id":1}`)
	store.data[string(makeHfDataKey("repo", "cfg", "train", 2))] = []byte(`{"id":2}`)

	meta := HfDatasetMeta{HfRepoID: "repo", Config: "cfg", Split: "train"}
	err := SaveHfDataset(meta, []HfDataRow{{ID: 7, Data: map[string]interface{}{"prompt": "new"}}})
	if err != nil {
		t.Fatalf("SaveHfDataset: %v", err)
	}

	if _, ok := store.data[string(makeHfDataKey("repo", "cfg", "train", 0))]; !ok {
		t.Fatal("expected new row 0 to be written")
	}
	if _, ok := store.data[string(makeHfDataKey("repo", "cfg", "train", 1))]; ok {
		t.Fatal("expected stale row 1 to be removed")
	}
	if _, ok := store.data[string(makeHfDataKey("repo", "cfg", "train", 2))]; ok {
		t.Fatal("expected stale row 2 to be removed")
	}

	var savedMeta HfDatasetMeta
	if err := json.Unmarshal(store.data[string(makeHfDatasetKey("repo", "cfg", "train"))], &savedMeta); err != nil {
		t.Fatalf("unmarshal saved meta: %v", err)
	}
	if savedMeta.RowCount != 1 {
		t.Fatalf("expected row count 1, got %d", savedMeta.RowCount)
	}
}
