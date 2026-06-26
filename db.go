package main

import (
	"lack-client/pkg/storage"
	"lack-client/pkg/utils"
	"path/filepath"
)

// DB provides a simplified interface to the embedded Badger database, exposed to the frontend via Wails bindings.
type DB struct{}

// NewDB creates a new database service instance.
func NewDB() *DB {
	return &DB{}
}

// Path returns the currently open database path, or the default path if not open.
func (d *DB) Path() string {
	return storage.Path()
}

// OpenDefault opens the database at the default path.
func (d *DB) OpenDefault() error {
	return storage.OpenDefault()
}

// OpenAt opens the database at the specified path, creating directories if necessary.
func (d *DB) OpenAt(path string) error {
	return storage.OpenAt(path)
}

// Close closes the database connection.
func (d *DB) Close() error {
	return storage.Close()
}

// OpenForUser opens a separate database for the specified user.
// This method uses atomic switching to prevent database state corruption.
func (d *DB) OpenForUser(userID string) error {
	var targetPath string
	if userID == "" {
		targetPath = storage.DefaultPath()
	} else {
		targetPath = filepath.Join(storage.DefaultPath(), "users", utils.SanitizeUserID(userID))
	}

	// Use SwitchTo for atomic database switching
	return storage.SwitchTo(targetPath)
}

// PutString writes a string key-value pair.
func (d *DB) PutString(key, value string) error {
	return storage.Put([]byte(key), []byte(value))
}

// GetString reads the string value for the specified key.
func (d *DB) GetString(key string) (string, error) {
	val, err := storage.Get([]byte(key))
	if err != nil {
		return "", err
	}
	return string(val), nil
}

// Delete removes the specified key.
func (d *DB) Delete(key string) error {
	return storage.Delete([]byte(key))
}

// KV represents a key-value pair for frontend transmission.
type KV struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// ListPrefix lists key-value pairs matching the prefix, with pagination.
func (d *DB) ListPrefix(prefix string, offset int, limit int) ([]KV, error) {
	if limit <= 0 || limit > maxListLimit {
		limit = maxListLimit
	}
	items, err := storage.ListByPrefix([]byte(prefix), offset, limit)
	if err != nil {
		return nil, err
	}
	res := make([]KV, 0, len(items))
	for _, it := range items {
		res = append(res, KV{Key: string(it.Key), Value: string(it.Value)})
	}
	return res, nil
}

// CountPrefix counts the number of keys matching the specified prefix.
func (d *DB) CountPrefix(prefix string) (int, error) {
	return storage.CountByPrefix([]byte(prefix))
}
