package cloudscan

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	git "github.com/go-git/go-git/v5"
	gittransport "github.com/go-git/go-git/v5/plumbing/transport"
	githttp "github.com/go-git/go-git/v5/plumbing/transport/http"
)

const (
	repositoryCloneTimeout = 5 * time.Minute
	repositoryScanTimeout  = repositoryCloneTimeout + kicsScanTimeout
	maxRepositoryBytes     = 250 << 20
	maxRepositoryFiles     = 20000
	repositoryWatchPeriod  = 750 * time.Millisecond
)

func prepareRepositoryTarget(ctx context.Context, target string) (string, func(), error) {
	cloneURL, auth, ok, err := parseCloneURL(target)
	if err != nil {
		return "", func() {}, err
	}
	if !ok {
		return "", func() {}, fmt.Errorf("repository target must be an HTTP(S) Git URL")
	}

	tmpDir, err := os.MkdirTemp("", "lack-cloudscan-repo-*")
	if err != nil {
		return "", func() {}, fmt.Errorf("create repository temp dir: %w", err)
	}
	cleanup := func() { _ = os.RemoveAll(tmpDir) }

	repoDir := filepath.Join(tmpDir, "repo")
	if ctx == nil {
		ctx = context.Background()
	}
	cloneCtx, timeoutCancel := context.WithTimeout(ctx, repositoryCloneTimeout)
	cloneCtx, cancel := context.WithCancel(cloneCtx)
	defer cancel()
	defer timeoutCancel()
	limitErrCh := watchRepositoryLimits(cloneCtx, cancel, repoDir, maxRepositoryBytes, maxRepositoryFiles)
	if _, err := git.PlainCloneContext(cloneCtx, repoDir, false, &git.CloneOptions{
		URL:          cloneURL,
		Auth:         auth,
		Depth:        1,
		SingleBranch: true,
		Tags:         git.NoTags,
	}); err != nil {
		cleanup()
		if limitErr := receiveLimitError(limitErrCh); limitErr != nil {
			return "", func() {}, limitErr
		}
		return "", func() {}, fmt.Errorf("clone repository: %w", err)
	}
	if err := checkRepositoryWithinLimits(repoDir, maxRepositoryBytes, maxRepositoryFiles); err != nil {
		cleanup()
		return "", func() {}, err
	}

	return repoDir, cleanup, nil
}

func watchRepositoryLimits(ctx context.Context, cancel context.CancelFunc, root string, maxBytes int64, maxFiles int) <-chan error {
	errCh := make(chan error, 1)
	go func() {
		ticker := time.NewTicker(repositoryWatchPeriod)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := checkRepositoryWithinLimits(root, maxBytes, maxFiles); err != nil {
					if os.IsNotExist(err) {
						continue
					}
					select {
					case errCh <- err:
					default:
					}
					cancel()
					return
				}
			}
		}
	}()
	return errCh
}

func receiveLimitError(errCh <-chan error) error {
	select {
	case err := <-errCh:
		return err
	default:
		return nil
	}
}

func prepareLocalRepositoryTarget(target string) (string, func(), error) {
	target = strings.TrimSpace(target)
	if strings.HasPrefix(strings.ToLower(target), "file://") {
		return "", func() {}, fmt.Errorf("local repository source requires a filesystem path, not file://")
	}
	absTarget, err := filepath.Abs(target)
	if err != nil {
		return "", func() {}, fmt.Errorf("resolve local repository path: %w", err)
	}
	info, err := os.Stat(absTarget)
	if err != nil {
		return "", func() {}, fmt.Errorf("access local repository path: %w", err)
	}
	if !info.IsDir() {
		return "", func() {}, fmt.Errorf("local repository path must be a directory")
	}
	if err := checkRepositoryWithinLimits(absTarget, maxRepositoryBytes, maxRepositoryFiles); err != nil {
		return "", func() {}, err
	}
	return absTarget, func() {}, nil
}

func checkRepositoryWithinLimits(root string, maxBytes int64, maxFiles int) error {
	var totalBytes int64
	var totalFiles int

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return err
		}
		totalFiles++
		totalBytes += info.Size()
		if maxFiles > 0 && totalFiles > maxFiles {
			return fmt.Errorf("repository contains too many files: %d exceeds %d", totalFiles, maxFiles)
		}
		if maxBytes > 0 && totalBytes > maxBytes {
			return fmt.Errorf("repository is too large: %d bytes exceeds %d bytes", totalBytes, maxBytes)
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("check repository size: %w", err)
	}
	return nil
}

func sanitizeRepositoryDisplayTarget(raw string) string {
	raw = strings.TrimSpace(raw)
	parsed, err := url.Parse(raw)
	if err != nil {
		return raw
	}

	switch parsed.Scheme {
	case "http", "https":
		parsed.User = nil
		return parsed.String()
	default:
		return raw
	}
}

func parseCloneURL(raw string) (string, gittransport.AuthMethod, bool, error) {
	raw = strings.TrimSpace(raw)
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", nil, false, fmt.Errorf("parse repository URL: %w", err)
	}

	switch parsed.Scheme {
	case "http", "https":
		auth := basicAuthFromURL(parsed)
		parsed.User = nil
		return parsed.String(), auth, true, nil
	default:
		return "", nil, false, nil
	}
}

func basicAuthFromURL(parsed *url.URL) gittransport.AuthMethod {
	if parsed == nil || parsed.User == nil {
		return nil
	}

	username := parsed.User.Username()
	password, hasPassword := parsed.User.Password()
	if username == "" && !hasPassword {
		return nil
	}
	return &githttp.BasicAuth{
		Username: username,
		Password: password,
	}
}
