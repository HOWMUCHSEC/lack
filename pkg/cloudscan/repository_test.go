package cloudscan

import (
	"context"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	git "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"
	githttp "github.com/go-git/go-git/v5/plumbing/transport/http"
)

func TestPrepareRepositoryTargetRejectsExistingLocalPath(t *testing.T) {
	dir := t.TempDir()

	_, _, err := prepareRepositoryTarget(context.Background(), dir)
	if err == nil {
		t.Fatal("expected existing local path to be rejected in repository mode")
	}
	if !strings.Contains(err.Error(), "HTTP(S) Git URL") {
		t.Fatalf("error = %q", err)
	}
}

func TestPrepareRepositoryTargetRejectsFileURL(t *testing.T) {
	sourceDir := createTestGitRepository(t)
	repoURL := (&url.URL{Scheme: "file", Path: sourceDir}).String()

	_, _, err := prepareRepositoryTarget(context.Background(), repoURL)
	if err == nil {
		t.Fatal("expected file:// URL to be rejected in repository mode")
	}
}

func TestPrepareLocalRepositoryTargetUsesExistingLocalPath(t *testing.T) {
	dir := t.TempDir()

	target, cleanup, err := prepareLocalRepositoryTarget(dir)
	if err != nil {
		t.Fatalf("prepareLocalRepositoryTarget() error = %v", err)
	}
	defer cleanup()

	if target != dir {
		t.Fatalf("target = %q, want %q", target, dir)
	}
}

func TestPrepareLocalRepositoryTargetRejectsFileURL(t *testing.T) {
	sourceDir := createTestGitRepository(t)
	repoURL := (&url.URL{Scheme: "file", Path: sourceDir}).String()

	_, _, err := prepareLocalRepositoryTarget(repoURL)
	if err == nil {
		t.Fatal("expected file:// URL to be rejected for explicit local mode")
	}
}

func TestPrepareRepositoryTargetRejectsUnknownTarget(t *testing.T) {
	_, _, err := prepareRepositoryTarget(context.Background(), "not-a-real-path-or-url")
	if err == nil {
		t.Fatal("expected error for unknown target")
	}
	if !strings.Contains(err.Error(), "HTTP(S) Git URL") {
		t.Fatalf("error = %q", err)
	}
}

func TestParseCloneURLStripsHTTPUserInfo(t *testing.T) {
	cloneURL, auth, ok, err := parseCloneURL("https://user:secret@example.test/org/repo.git")
	if err != nil {
		t.Fatalf("parseCloneURL() error = %v", err)
	}
	if !ok {
		t.Fatal("expected HTTPS URL to be cloneable")
	}
	if strings.Contains(cloneURL, "secret") || strings.Contains(cloneURL, "user@") {
		t.Fatalf("cloneURL leaked credentials: %q", cloneURL)
	}

	basicAuth, ok := auth.(*githttp.BasicAuth)
	if !ok {
		t.Fatalf("auth = %T, want *http.BasicAuth", auth)
	}
	if basicAuth.Username != "user" || basicAuth.Password != "secret" {
		t.Fatalf("auth = %#v, want user/secret", basicAuth)
	}
}

func TestSanitizeRepositoryDisplayTargetStripsHTTPUserInfo(t *testing.T) {
	target := sanitizeRepositoryDisplayTarget("https://user:secret@example.test/org/repo.git")

	if target != "https://example.test/org/repo.git" {
		t.Fatalf("target = %q, want sanitized URL", target)
	}
	if strings.Contains(target, "secret") || strings.Contains(target, "user@") {
		t.Fatalf("target leaked credentials: %q", target)
	}
}

func TestSanitizeRepositoryDisplayTargetKeepsLocalPaths(t *testing.T) {
	target := "/tmp/user:secret@example.test/repo"

	if got := sanitizeRepositoryDisplayTarget(target); got != target {
		t.Fatalf("target = %q, want local path unchanged", got)
	}
}

func TestCheckRepositoryWithinLimitsRejectsTooManyFiles(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "one.tf"), []byte("a"), 0600); err != nil {
		t.Fatalf("write one.tf: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "two.tf"), []byte("b"), 0600); err != nil {
		t.Fatalf("write two.tf: %v", err)
	}

	err := checkRepositoryWithinLimits(dir, 1024, 1)
	if err == nil {
		t.Fatal("expected too many files error")
	}
	if !strings.Contains(err.Error(), "too many files") {
		t.Fatalf("error = %q", err)
	}
}

func TestCheckRepositoryWithinLimitsRejectsTooManyBytes(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "main.tf"), []byte("abcdef"), 0600); err != nil {
		t.Fatalf("write main.tf: %v", err)
	}

	err := checkRepositoryWithinLimits(dir, 3, 10)
	if err == nil {
		t.Fatal("expected repository too large error")
	}
	if !strings.Contains(err.Error(), "too large") {
		t.Fatalf("error = %q", err)
	}
}

func createTestGitRepository(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "main.tf"), []byte(`resource "aws_s3_bucket" "demo" {}`), 0600); err != nil {
		t.Fatalf("write test repository file: %v", err)
	}

	repo, err := git.PlainInit(dir, false)
	if err != nil {
		t.Fatalf("init test repository: %v", err)
	}
	wt, err := repo.Worktree()
	if err != nil {
		t.Fatalf("open test repository worktree: %v", err)
	}
	if _, err := wt.Add("main.tf"); err != nil {
		t.Fatalf("add test repository file: %v", err)
	}
	if _, err := wt.Commit("initial commit", &git.CommitOptions{
		Author: &object.Signature{
			Name:  "Lack Test",
			Email: "lack@example.test",
			When:  time.Unix(0, 0),
		},
	}); err != nil {
		t.Fatalf("commit test repository file: %v", err)
	}

	return dir
}
