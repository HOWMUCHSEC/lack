package storage

import (
	"bytes"
	"errors"
	"fmt"
	"lack-client/pkg/config"
	"lack-client/pkg/logger"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	badger "github.com/dgraph-io/badger/v4"
)

var (
	openedDB            *badger.DB
	dbMutex             sync.RWMutex
	dbPath              string
	gcStopChan          chan struct{} // GC stop signal
	gcDoneChan          chan struct{} // GC done signal
	switchMutex         sync.Mutex    // Mutex to serialize database lifecycle changes.
	longOpsMu           sync.Mutex
	longOpsCond         = sync.NewCond(&longOpsMu)
	activeLongOps       int
	extraAllowedDBRoots []string
)

const privateDirPerm os.FileMode = 0o700

var (
	errDBNotOpened = errors.New("badger db is not opened")
	ErrKeyNotFound = badger.ErrKeyNotFound
)

// executableDir returns the directory of the current executable.
func executableDir() string {
	exe, err := os.Executable()
	if err != nil {
		cwd, err2 := os.Getwd()
		if err2 != nil {
			return "."
		}
		return cwd
	}
	return filepath.Dir(exe)
}

// appDataDir returns the application data directory (auto-adapted for OS).
func appDataDir(appName string) string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(executableDir(), appName)
	}
	switch runtime.GOOS {
	case "windows":
		base := os.Getenv("LOCALAPPDATA")
		if base == "" {
			if cdir, err := os.UserConfigDir(); err == nil && cdir != "" {
				base = cdir
			} else {
				base = filepath.Join(home, "AppData", "Roaming")
			}
		}
		return filepath.Join(base, appName)
	case "darwin":
		return filepath.Join(home, "Library", "Application Support", appName)
	default:
		base := os.Getenv("XDG_DATA_HOME")
		if base == "" {
			base = filepath.Join(home, ".local", "share")
		}
		return filepath.Join(base, appName)
	}
}

// DefaultPath returns the default Badger database directory path.
func DefaultPath() string {
	return appDataDir("lack")
}

// OpenDefault opens the database at the default path, creating it if necessary.
func OpenDefault() error {
	return OpenAt(DefaultPath())
}

// OpenAt opens the database at the specified path, creating directories if necessary.
func OpenAt(path string) error {
	switchMutex.Lock()
	defer switchMutex.Unlock()

	validated, err := validateDBPath(path)
	if err != nil {
		return err
	}
	if err := ensurePrivateDBDir(validated.path, validated.root); err != nil {
		return err
	}

	dbMutex.Lock()
	if openedDB != nil {
		dbMutex.Unlock()
		return nil
	}
	dbMutex.Unlock()

	db, err := openBadgerDB(validated.path)
	if err != nil {
		return err
	}

	stop, done := startGC(db)

	dbMutex.Lock()
	openedDB = db
	dbPath = validated.path
	gcStopChan = stop
	gcDoneChan = done
	dbMutex.Unlock()

	logger.Info("Badger: database opened", "path", validated.path)

	return nil
}

// startGC starts the background GC goroutine.
func startGC(db *badger.DB) (chan struct{}, chan struct{}) {
	stop := make(chan struct{})
	done := make(chan struct{})
	go func() {
		defer close(done)
		interval := time.Duration(config.GCInterval) * time.Minute
		if interval <= 0 {
			interval = 5 * time.Minute
		}
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				runGC(db, stop)
			}
		}
	}()
	return stop, done
}

// runGC performs a single GC to reclaim value log space.
func runGC(db *badger.DB, stop <-chan struct{}) {
	if db == nil {
		return
	}
	// Use configured waste ratio
	for {
		select {
		case <-stop:
			return
		default:
		}
		err := db.RunValueLogGC(config.GCDiscardRatio)
		if err != nil {
			// ErrNoRewrite means no more space to reclaim, exit normally
			break
		}
	}
}

func stopGC(stop chan struct{}, done chan struct{}) {
	if stop != nil {
		close(stop)
	}
	if done != nil {
		<-done
	}
}

// Close closes the opened database.
func Close() error {
	switchMutex.Lock()
	defer switchMutex.Unlock()

	waitForLongOperations()

	dbMutex.Lock()
	if openedDB == nil {
		dbPath = ""
		dbMutex.Unlock()
		return nil
	}
	db := openedDB
	stop := gcStopChan
	done := gcDoneChan
	openedDB = nil
	dbPath = ""
	gcStopChan = nil
	gcDoneChan = nil
	dbMutex.Unlock()

	stopGC(stop, done)

	err := db.Close()
	if err != nil {
		logger.Error("Badger: failed to close database", "error", err)
	} else {
		logger.Info("Badger: database closed")
	}
	return err
}

// DB returns the underlying *badger.DB instance, or nil if not open.
func DB() *badger.DB {
	dbMutex.RLock()
	defer dbMutex.RUnlock()
	return openedDB
}

// Path returns the currently open database path (or default path if not open).
func Path() string {
	dbMutex.RLock()
	defer dbMutex.RUnlock()
	if dbPath != "" {
		return dbPath
	}
	return DefaultPath()
}

func withOpenDB(fn func(*badger.DB) error) error {
	dbMutex.RLock()
	defer dbMutex.RUnlock()
	if openedDB == nil {
		return errDBNotOpened
	}
	return fn(openedDB)
}

// BeginLongOperation prevents database lifecycle changes until the returned
// release function is called. It is intended for service-level tasks that span
// multiple storage calls and must not run across a DB switch.
func BeginLongOperation() (func(), error) {
	switchMutex.Lock()
	defer switchMutex.Unlock()

	dbMutex.RLock()
	if openedDB == nil {
		dbMutex.RUnlock()
		return nil, errDBNotOpened
	}
	dbMutex.RUnlock()

	longOpsMu.Lock()
	activeLongOps++
	longOpsMu.Unlock()

	var once sync.Once
	return func() {
		once.Do(func() {
			longOpsMu.Lock()
			activeLongOps--
			longOpsCond.Broadcast()
			longOpsMu.Unlock()
		})
	}, nil
}

func waitForLongOperations() {
	longOpsMu.Lock()
	defer longOpsMu.Unlock()
	for activeLongOps > 0 {
		longOpsCond.Wait()
	}
}

// Put writes a key-value pair.
func Put(key, value []byte) error {
	err := withOpenDB(func(db *badger.DB) error {
		return db.Update(func(txn *badger.Txn) error {
			return txn.Set(key, value)
		})
	})
	if errors.Is(err, errDBNotOpened) {
		logger.Warn("Badger: Put called but db is not opened", "key", string(key))
		return err
	}
	if err != nil {
		logger.Warn("Badger: Put failed", "key", string(key), "error", err)
	}
	return err
}

// Get reads a value by key, returning a copy of the value.
func Get(key []byte) ([]byte, error) {
	var valCopy []byte
	err := withOpenDB(func(db *badger.DB) error {
		return db.View(func(txn *badger.Txn) error {
			item, err := txn.Get(key)
			if err != nil {
				return err
			}
			return item.Value(func(val []byte) error {
				valCopy = append([]byte{}, val...)
				return nil
			})
		})
	})
	if errors.Is(err, errDBNotOpened) {
		logger.Warn("Badger: Get called but db is not opened", "key", string(key))
		return nil, err
	}
	// 只记录非 KeyNotFound 的错误
	if err != nil && err != badger.ErrKeyNotFound {
		logger.Warn("Badger: Get failed", "key", string(key), "error", err)
	}
	return valCopy, err
}

// Delete deletes a specific key.
func Delete(key []byte) error {
	err := withOpenDB(func(db *badger.DB) error {
		return db.Update(func(txn *badger.Txn) error {
			return txn.Delete(key)
		})
	})
	if errors.Is(err, errDBNotOpened) {
		logger.Warn("Badger: Delete called but db is not opened", "key", string(key))
		return err
	}
	if err != nil && err != badger.ErrKeyNotFound {
		logger.Warn("Badger: Delete failed", "key", string(key), "error", err)
	}
	return err
}

// ListByPrefix returns key-value pairs starting with the specified prefix, with pagination.
// Skips offset items, returns at most limit items. If limit <= 0, returns all remaining items.
func ListByPrefix(prefix []byte, offset, limit int) ([]KVItem, error) {
	result := make([]KVItem, 0)
	err := withOpenDB(func(db *badger.DB) error {
		return db.View(func(txn *badger.Txn) error {
			opts := badger.DefaultIteratorOptions
			opts.PrefetchValues = true
			it := txn.NewIterator(opts)
			defer it.Close()
			skipped := 0
			returned := 0
			for it.Seek(prefix); it.ValidForPrefix(prefix); it.Next() {
				if offset > 0 && skipped < offset {
					skipped++
					continue
				}
				if limit > 0 && returned >= limit {
					break
				}
				item := it.Item()
				k := append([]byte{}, item.Key()...)
				var vcopy []byte
				if err := item.Value(func(v []byte) error {
					vcopy = append([]byte{}, v...)
					return nil
				}); err != nil {
					return err
				}
				result = append(result, KVItem{Key: k, Value: vcopy})
				returned++
			}
			return nil
		})
	})
	return result, err
}

// ListKeysByPrefix returns keys starting with the specified prefix without
// reading values. If limit <= 0, it returns all remaining keys.
func ListKeysByPrefix(prefix []byte, offset, limit int) ([][]byte, error) {
	result := make([][]byte, 0)
	err := withOpenDB(func(db *badger.DB) error {
		return db.View(func(txn *badger.Txn) error {
			opts := badger.DefaultIteratorOptions
			opts.PrefetchValues = false
			it := txn.NewIterator(opts)
			defer it.Close()
			skipped := 0
			returned := 0
			for it.Seek(prefix); it.ValidForPrefix(prefix); it.Next() {
				if offset > 0 && skipped < offset {
					skipped++
					continue
				}
				if limit > 0 && returned >= limit {
					break
				}
				result = append(result, append([]byte{}, it.Item().Key()...))
				returned++
			}
			return nil
		})
	})
	return result, err
}

// ListKeysByPrefixReverse returns keys starting with prefix in reverse
// lexicographical order without reading values.
func ListKeysByPrefixReverse(prefix []byte, offset, limit int) ([][]byte, error) {
	result := make([][]byte, 0)
	err := withOpenDB(func(db *badger.DB) error {
		return db.View(func(txn *badger.Txn) error {
			opts := badger.DefaultIteratorOptions
			opts.PrefetchValues = false
			opts.Reverse = true
			it := txn.NewIterator(opts)
			defer it.Close()

			seek := append(append([]byte{}, prefix...), 0xff)
			skipped := 0
			returned := 0
			for it.Seek(seek); it.Valid(); it.Next() {
				key := it.Item().Key()
				if !bytes.HasPrefix(key, prefix) {
					break
				}
				if offset > 0 && skipped < offset {
					skipped++
					continue
				}
				if limit > 0 && returned >= limit {
					break
				}
				result = append(result, append([]byte{}, key...))
				returned++
			}
			return nil
		})
	})
	return result, err
}

// CountByPrefix returns the number of keys with the specified prefix.
func CountByPrefix(prefix []byte) (int, error) {
	count := 0
	err := withOpenDB(func(db *badger.DB) error {
		return db.View(func(txn *badger.Txn) error {
			opts := badger.DefaultIteratorOptions
			opts.PrefetchValues = false
			it := txn.NewIterator(opts)
			defer it.Close()
			for it.Seek(prefix); it.ValidForPrefix(prefix); it.Next() {
				count++
			}
			return nil
		})
	})
	return count, err
}

// BatchItem represents a key-value pair for batch operations.
type BatchItem struct {
	Key   []byte
	Value []byte
}

// PutBatch writes key-value pairs in batch using WriteBatch for performance.
func PutBatch(items []BatchItem) error {
	return withOpenDB(func(db *badger.DB) error {
		if len(items) == 0 {
			return nil
		}

		wb := db.NewWriteBatch()
		defer wb.Cancel()

		for _, item := range items {
			if err := wb.Set(item.Key, item.Value); err != nil {
				return err
			}
		}
		return wb.Flush()
	})
}

// DeleteBatch deletes keys in batch.
func DeleteBatch(keys [][]byte) error {
	return withOpenDB(func(db *badger.DB) error {
		if len(keys) == 0 {
			return nil
		}

		wb := db.NewWriteBatch()
		defer wb.Cancel()

		for _, key := range keys {
			if err := wb.Delete(key); err != nil {
				return err
			}
		}
		return wb.Flush()
	})
}

// DeleteByPrefix deletes all keys with the specified prefix without reading
// their values. It returns the number of keys scheduled for deletion.
func DeleteByPrefix(prefix []byte) (int, error) {
	keys, err := ListKeysByPrefix(prefix, 0, 0)
	if err != nil {
		return 0, err
	}
	if err := DeleteBatch(keys); err != nil {
		return 0, err
	}
	return len(keys), nil
}

// openBadgerDB opens Badger and preserves its exclusive LOCK semantics.
func openBadgerDB(path string) (*badger.DB, error) {
	opts := badger.DefaultOptions(path)
	opts.Logger = nil

	db, err := badger.Open(opts)
	if err == nil {
		return db, nil
	}

	logger.Error("Badger: failed to open database", "path", path, "error", err)
	return nil, err
}

type validatedDBPath struct {
	path string
	root string
}

func validateDBPath(path string) (validatedDBPath, error) {
	if strings.TrimSpace(path) == "" {
		return validatedDBPath{}, errors.New("badger path is empty")
	}

	absPath, err := cleanAbs(path)
	if err != nil {
		return validatedDBPath{}, err
	}

	for _, root := range allowedDBRoots() {
		absRoot, err := cleanAbs(root)
		if err != nil {
			return validatedDBPath{}, err
		}
		inside, err := pathWithinRoot(absPath, absRoot)
		if err != nil {
			return validatedDBPath{}, err
		}
		if !inside {
			continue
		}
		if err := ensureNoSymlinkEscape(absPath, absRoot); err != nil {
			return validatedDBPath{}, err
		}
		return validatedDBPath{path: absPath, root: absRoot}, nil
	}

	return validatedDBPath{}, fmt.Errorf("badger path %q is outside allowed storage roots", path)
}

func allowedDBRoots() []string {
	roots := []string{DefaultPath()}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		roots = append(roots, filepath.Join(home, ".lack"))
	}
	roots = append(roots, extraAllowedDBRoots...)
	return roots
}

func cleanAbs(path string) (string, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	return filepath.Clean(absPath), nil
}

func ensurePrivateDBDir(path, root string) error {
	if err := os.MkdirAll(path, privateDirPerm); err != nil {
		logger.Error("Badger: failed to create directory", "path", path, "error", err)
		return err
	}

	rel, err := filepath.Rel(root, path)
	if err != nil {
		return err
	}
	dirs := []string{root}
	if rel != "." {
		current := root
		for _, part := range strings.Split(rel, string(os.PathSeparator)) {
			current = filepath.Join(current, part)
			dirs = append(dirs, current)
		}
	}
	for _, dir := range dirs {
		if err := os.Chmod(dir, privateDirPerm); err != nil {
			logger.Error("Badger: failed to set private directory permissions", "path", dir, "error", err)
			return err
		}
	}
	return nil
}

func ensureNoSymlinkEscape(path, root string) error {
	resolvedPath, err := resolvePathForCreation(path)
	if err != nil {
		return err
	}
	resolvedRoot, err := resolvePathForCreation(root)
	if err != nil {
		return err
	}
	inside, err := pathWithinRoot(resolvedPath, resolvedRoot)
	if err != nil {
		return err
	}
	if !inside {
		return fmt.Errorf("badger path %q escapes allowed storage root %q", path, root)
	}
	return nil
}

func resolvePathForCreation(path string) (string, error) {
	path = filepath.Clean(path)
	var suffix []string
	current := path
	for {
		resolved, err := filepath.EvalSymlinks(current)
		if err == nil {
			for i := len(suffix) - 1; i >= 0; i-- {
				resolved = filepath.Join(resolved, suffix[i])
			}
			return filepath.Clean(resolved), nil
		}
		if !os.IsNotExist(err) {
			return "", err
		}
		parent := filepath.Dir(current)
		if parent == current {
			return filepath.Clean(path), nil
		}
		suffix = append(suffix, filepath.Base(current))
		current = parent
	}
}

func pathWithinRoot(path, root string) (bool, error) {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return false, err
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))), nil
}

// SwitchTo atomically switches to a different database path.
// It first verifies the new path is accessible before closing the current database.
// If the new path fails to open, the original database remains open.
func SwitchTo(newPath string) error {
	switchMutex.Lock()
	defer switchMutex.Unlock()

	waitForLongOperations()

	validated, err := validateDBPath(newPath)
	if err != nil {
		return err
	}
	if err := ensurePrivateDBDir(validated.path, validated.root); err != nil {
		return err
	}

	dbMutex.RLock()
	currentPath := dbPath
	currentDB := openedDB
	dbMutex.RUnlock()

	// If already at the target path and DB is open, nothing to do
	if currentDB != nil && currentPath == validated.path {
		logger.Debug("Badger: already at target path", "path", validated.path)
		return nil
	}

	newDB, err := openBadgerDB(validated.path)
	if err != nil {
		return err
	}
	newStop, newDone := startGC(newDB)

	// Step 2 & 3: Atomically swap to new database, then cleanup old resources
	dbMutex.Lock()
	oldDB := openedDB
	oldStop := gcStopChan
	oldDone := gcDoneChan
	openedDB = newDB // Atomically switch to new DB
	dbPath = validated.path
	gcStopChan = newStop
	gcDoneChan = newDone
	dbMutex.Unlock()

	stopGC(oldStop, oldDone)

	if oldDB != nil {
		if closeErr := oldDB.Close(); closeErr != nil {
			logger.Error("Badger: failed to close old database during switch", "error", closeErr)
			// Continue anyway, as we already have the new DB open
		} else {
			logger.Info("Badger: old database closed during switch", "path", currentPath)
		}
	}

	logger.Info("Badger: database switched", "from", currentPath, "to", validated.path)

	return nil
}
