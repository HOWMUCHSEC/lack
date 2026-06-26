package storage

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
)

func withTestStorageRoot(t *testing.T) string {
	t.Helper()

	if err := Close(); err != nil {
		t.Fatalf("close existing db: %v", err)
	}

	root := t.TempDir()
	oldRoots := extraAllowedDBRoots
	extraAllowedDBRoots = []string{root}

	t.Cleanup(func() {
		if err := Close(); err != nil {
			t.Fatalf("close db: %v", err)
		}
		extraAllowedDBRoots = oldRoots
	})

	return root
}

func TestOpenAtCreatesPrivateDirectory(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("directory permission bits are platform-specific on Windows")
	}

	root := withTestStorageRoot(t)
	dbPath := filepath.Join(root, "db", "nested")

	if err := OpenAt(dbPath); err != nil {
		t.Fatalf("OpenAt: %v", err)
	}

	info, err := os.Stat(dbPath)
	if err != nil {
		t.Fatalf("stat db path: %v", err)
	}
	if got := info.Mode().Perm(); got != privateDirPerm {
		t.Fatalf("db directory mode = %o, want %o", got, privateDirPerm)
	}
}

func TestOpenAtRejectsPathOutsideAllowedRoots(t *testing.T) {
	root := withTestStorageRoot(t)
	outside := filepath.Join(root, "..", "outside-db")

	if err := OpenAt(outside); err == nil {
		t.Fatal("OpenAt succeeded for a path outside allowed roots")
	}
	if _, err := os.Stat(outside); !os.IsNotExist(err) {
		t.Fatalf("outside path was created or stat failed unexpectedly: %v", err)
	}
}

func TestOpenAtRejectsSymlinkEscape(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink creation requires elevated privileges on some Windows hosts")
	}

	root := withTestStorageRoot(t)
	outside := t.TempDir()
	link := filepath.Join(root, "link")
	if err := os.Symlink(outside, link); err != nil {
		t.Fatalf("create symlink: %v", err)
	}

	escapedDB := filepath.Join(link, "db")
	if err := OpenAt(escapedDB); err == nil {
		t.Fatal("OpenAt succeeded for a path escaping through a symlink")
	}
	if _, err := os.Stat(filepath.Join(outside, "db")); !os.IsNotExist(err) {
		t.Fatalf("escaped path was created or stat failed unexpectedly: %v", err)
	}
}

func TestOpenAtDoesNotRemoveBadgerLock(t *testing.T) {
	root := withTestStorageRoot(t)
	dbPath := filepath.Join(root, "locked-db")

	if err := os.MkdirAll(dbPath, privateDirPerm); err != nil {
		t.Fatalf("mkdir db path: %v", err)
	}

	opts := badger.DefaultOptions(dbPath)
	opts.Logger = nil
	holder, err := badger.Open(opts)
	if err != nil {
		t.Fatalf("open lock holder: %v", err)
	}
	defer holder.Close()

	lockPath := filepath.Join(dbPath, "LOCK")
	oldTime := time.Now().Add(-time.Hour)
	if err := os.Chtimes(lockPath, oldTime, oldTime); err != nil {
		t.Fatalf("age lock file: %v", err)
	}

	if err := OpenAt(dbPath); err == nil {
		t.Fatal("OpenAt succeeded while another Badger instance held the lock")
	}
	if _, err := os.Stat(lockPath); err != nil {
		t.Fatalf("LOCK file was removed or became inaccessible: %v", err)
	}
}

func TestCloseClearsPath(t *testing.T) {
	root := withTestStorageRoot(t)
	dbPath := filepath.Join(root, "db")

	if err := OpenAt(dbPath); err != nil {
		t.Fatalf("OpenAt: %v", err)
	}
	if got := Path(); got != dbPath {
		t.Fatalf("Path() before close = %q, want %q", got, dbPath)
	}
	if err := Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}
	if got, want := Path(), DefaultPath(); got != want {
		t.Fatalf("Path() after close = %q, want %q", got, want)
	}
}

func TestSwitchToFailureKeepsCurrentDatabase(t *testing.T) {
	root := withTestStorageRoot(t)
	currentPath := filepath.Join(root, "current-db")
	lockedPath := filepath.Join(root, "locked-db")
	key := []byte("switch-failure:key")
	value := []byte("still-current")

	if err := OpenAt(currentPath); err != nil {
		t.Fatalf("OpenAt current: %v", err)
	}
	if err := Put(key, value); err != nil {
		t.Fatalf("Put current value: %v", err)
	}
	if err := os.MkdirAll(lockedPath, privateDirPerm); err != nil {
		t.Fatalf("mkdir locked db path: %v", err)
	}

	opts := badger.DefaultOptions(lockedPath)
	opts.Logger = nil
	holder, err := badger.Open(opts)
	if err != nil {
		t.Fatalf("open lock holder: %v", err)
	}
	defer holder.Close()

	lockPath := filepath.Join(lockedPath, "LOCK")
	oldTime := time.Now().Add(-time.Hour)
	if err := os.Chtimes(lockPath, oldTime, oldTime); err != nil {
		t.Fatalf("age lock file: %v", err)
	}

	if err := SwitchTo(lockedPath); err == nil {
		t.Fatal("SwitchTo succeeded while another Badger instance held the target lock")
	}
	if got := Path(); got != currentPath {
		t.Fatalf("Path() after failed switch = %q, want %q", got, currentPath)
	}
	gotValue, err := Get(key)
	if err != nil {
		t.Fatalf("Get current value after failed switch: %v", err)
	}
	if string(gotValue) != string(value) {
		t.Fatalf("value after failed switch = %q, want %q", gotValue, value)
	}
	if _, err := os.Stat(lockPath); err != nil {
		t.Fatalf("LOCK file was removed or became inaccessible: %v", err)
	}
}

func TestCloseWaitsForActiveOperation(t *testing.T) {
	root := withTestStorageRoot(t)
	if err := OpenAt(filepath.Join(root, "db")); err != nil {
		t.Fatalf("OpenAt: %v", err)
	}

	entered := make(chan struct{})
	release := make(chan struct{})
	opDone := make(chan error, 1)
	go func() {
		opDone <- withOpenDB(func(*badger.DB) error {
			close(entered)
			<-release
			return nil
		})
	}()
	<-entered

	closeDone := make(chan error, 1)
	go func() {
		closeDone <- Close()
	}()

	select {
	case err := <-closeDone:
		t.Fatalf("Close returned before active operation released: %v", err)
	case <-time.After(50 * time.Millisecond):
	}

	close(release)
	if err := <-opDone; err != nil {
		t.Fatalf("active operation: %v", err)
	}
	if err := <-closeDone; err != nil {
		t.Fatalf("Close: %v", err)
	}
}

func TestSwitchToWaitsForActiveOperation(t *testing.T) {
	root := withTestStorageRoot(t)
	if err := OpenAt(filepath.Join(root, "db1")); err != nil {
		t.Fatalf("OpenAt: %v", err)
	}

	entered := make(chan struct{})
	release := make(chan struct{})
	opDone := make(chan error, 1)
	go func() {
		opDone <- withOpenDB(func(*badger.DB) error {
			close(entered)
			<-release
			return nil
		})
	}()
	<-entered

	switchDone := make(chan error, 1)
	target := filepath.Join(root, "db2")
	go func() {
		switchDone <- SwitchTo(target)
	}()

	select {
	case err := <-switchDone:
		t.Fatalf("SwitchTo returned before active operation released: %v", err)
	case <-time.After(50 * time.Millisecond):
	}

	close(release)
	if err := <-opDone; err != nil {
		t.Fatalf("active operation: %v", err)
	}
	if err := <-switchDone; err != nil {
		t.Fatalf("SwitchTo: %v", err)
	}
	if got := Path(); got != target {
		t.Fatalf("Path() = %q, want %q", got, target)
	}
}

func TestListKeysByPrefixAndDeleteByPrefix(t *testing.T) {
	root := withTestStorageRoot(t)
	if err := OpenAt(filepath.Join(root, "db")); err != nil {
		t.Fatalf("OpenAt: %v", err)
	}

	items := []BatchItem{
		{Key: []byte("key-only:a"), Value: []byte("large value a")},
		{Key: []byte("key-only:b"), Value: []byte("large value b")},
		{Key: []byte("other:c"), Value: []byte("keep")},
	}
	if err := PutBatch(items); err != nil {
		t.Fatalf("PutBatch: %v", err)
	}

	keys, err := ListKeysByPrefix([]byte("key-only:"), 1, 1)
	if err != nil {
		t.Fatalf("ListKeysByPrefix: %v", err)
	}
	if len(keys) != 1 || string(keys[0]) != "key-only:b" {
		t.Fatalf("ListKeysByPrefix page = %q, want [key-only:b]", keys)
	}

	deleted, err := DeleteByPrefix([]byte("key-only:"))
	if err != nil {
		t.Fatalf("DeleteByPrefix: %v", err)
	}
	if deleted != 2 {
		t.Fatalf("deleted = %d, want 2", deleted)
	}
	if count, err := CountByPrefix([]byte("key-only:")); err != nil || count != 0 {
		t.Fatalf("key-only count = %d, err = %v; want 0, nil", count, err)
	}
	if count, err := CountByPrefix([]byte("other:")); err != nil || count != 1 {
		t.Fatalf("other count = %d, err = %v; want 1, nil", count, err)
	}
}

func TestBeginLongOperationBlocksSwitchAndAllowsNestedStorageCalls(t *testing.T) {
	root := withTestStorageRoot(t)
	current := filepath.Join(root, "db1")
	target := filepath.Join(root, "db2")
	if err := OpenAt(current); err != nil {
		t.Fatalf("OpenAt: %v", err)
	}

	release, err := BeginLongOperation()
	if err != nil {
		t.Fatalf("BeginLongOperation: %v", err)
	}
	defer release()

	switchDone := make(chan error, 1)
	go func() {
		switchDone <- SwitchTo(target)
	}()

	select {
	case err := <-switchDone:
		t.Fatalf("SwitchTo returned before long operation released: %v", err)
	case <-time.After(50 * time.Millisecond):
	}

	if err := Put([]byte("long-op:key"), []byte("value")); err != nil {
		t.Fatalf("Put while SwitchTo waits on long operation: %v", err)
	}
	got, err := Get([]byte("long-op:key"))
	if err != nil {
		t.Fatalf("Get while SwitchTo waits on long operation: %v", err)
	}
	if string(got) != "value" {
		t.Fatalf("Get = %q, want value", got)
	}

	release()
	if err := <-switchDone; err != nil {
		t.Fatalf("SwitchTo: %v", err)
	}
	if got := Path(); got != target {
		t.Fatalf("Path() = %q, want %q", got, target)
	}
}
