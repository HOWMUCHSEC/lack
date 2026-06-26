package storage

// KVItem represents a key-value pair.
type KVItem struct {
	Key   []byte
	Value []byte
}

// KVStore defines the key-value store interface, facilitating testing and future implementation replacement.
type KVStore interface {
	// Get retrieves value for a specific key.
	Get(key []byte) ([]byte, error)
	// Put stores a key-value pair.
	Put(key, value []byte) error
	// Delete removes a specific key.
	Delete(key []byte) error
	// ListByPrefix lists key-value pairs by prefix.
	ListByPrefix(prefix []byte, offset, limit int) ([]KVItem, error)
	// CountByPrefix counts items matching the prefix.
	CountByPrefix(prefix []byte) (int, error)
	// PutBatch performs batch write.
	PutBatch(items []BatchItem) error
	// DeleteBatch performs batch delete.
	DeleteBatch(keys [][]byte) error
	// Close closes the store.
	Close() error
}

// Ensure BadgerDB implements KVStore at compile time
var _ KVStore = (*badgerStore)(nil)

// badgerStore wraps the global Badger operations to implement KVStore
type badgerStore struct{}

// DefaultStore returns the default KVStore implementation using BadgerDB
func DefaultStore() KVStore {
	return &badgerStore{}
}

func (s *badgerStore) Get(key []byte) ([]byte, error) {
	return Get(key)
}

func (s *badgerStore) Put(key, value []byte) error {
	return Put(key, value)
}

func (s *badgerStore) Delete(key []byte) error {
	return Delete(key)
}

func (s *badgerStore) ListByPrefix(prefix []byte, offset, limit int) ([]KVItem, error) {
	return ListByPrefix(prefix, offset, limit)
}

func (s *badgerStore) CountByPrefix(prefix []byte) (int, error) {
	return CountByPrefix(prefix)
}

func (s *badgerStore) PutBatch(items []BatchItem) error {
	return PutBatch(items)
}

func (s *badgerStore) DeleteBatch(keys [][]byte) error {
	return DeleteBatch(keys)
}

func (s *badgerStore) Close() error {
	return Close()
}
