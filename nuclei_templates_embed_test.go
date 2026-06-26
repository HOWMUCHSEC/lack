package main

import (
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

type aiLLMTemplateProfile struct {
	Templates []string `yaml:"templates"`
}

func TestEmbeddedNucleiTemplatesOnlyIncludeAIProfile(t *testing.T) {
	profilePath := filepath.Join("nuclei-templates", "profiles", "ai-llm.yaml")
	profileBytes, err := os.ReadFile(profilePath)
	if err != nil {
		t.Fatalf("failed to read %s: %v", profilePath, err)
	}

	var profile aiLLMTemplateProfile
	if err := yaml.Unmarshal(profileBytes, &profile); err != nil {
		t.Fatalf("failed to parse %s: %v", profilePath, err)
	}
	if len(profile.Templates) != 212 {
		t.Fatalf("expected AI/LLM profile to contain 212 templates, got %d", len(profile.Templates))
	}
	if _, err := nucleiTemplates.ReadFile(profilePath); err != nil {
		t.Fatalf("AI/LLM profile is not embedded: %v", err)
	}

	allowed := make(map[string]struct{}, len(profile.Templates))
	for _, raw := range profile.Templates {
		relPath := filepath.ToSlash(strings.TrimSpace(raw))
		if relPath == "" {
			t.Fatal("AI/LLM profile contains an empty template path")
		}
		if !strings.HasSuffix(strings.ToLower(relPath), ".yaml") && !strings.HasSuffix(strings.ToLower(relPath), ".yml") {
			t.Fatalf("AI/LLM profile contains non-YAML template path %q", relPath)
		}
		if _, exists := allowed[relPath]; exists {
			t.Fatalf("AI/LLM profile contains duplicate template path %q", relPath)
		}
		allowed[relPath] = struct{}{}

		embeddedPath := filepath.ToSlash(filepath.Join("nuclei-templates", relPath))
		if _, err := nucleiTemplates.ReadFile(embeddedPath); err != nil {
			t.Fatalf("profile template %q is not embedded: %v", relPath, err)
		}
	}

	var unexpected []string
	var embeddedTemplateCount int
	err = fs.WalkDir(nucleiTemplates, "nuclei-templates", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}

		relPath := strings.TrimPrefix(filepath.ToSlash(path), "nuclei-templates/")
		if relPath == filepath.ToSlash(filepath.Join("profiles", "ai-llm.yaml")) {
			return nil
		}
		if _, ok := allowed[relPath]; ok {
			embeddedTemplateCount++
			return nil
		}
		unexpected = append(unexpected, relPath)
		return nil
	})
	if err != nil {
		t.Fatalf("failed to walk embedded nuclei templates: %v", err)
	}

	if len(unexpected) > 0 {
		sort.Strings(unexpected)
		t.Fatalf("embedded nuclei templates contain files outside the 212-template AI/LLM profile: %s", strings.Join(unexpected, ", "))
	}
	if embeddedTemplateCount != len(allowed) {
		t.Fatalf("expected %d embedded AI/LLM templates, got %d", len(allowed), embeddedTemplateCount)
	}
}
