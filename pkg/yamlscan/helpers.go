package yamlscan

import (
	"regexp"
	"strings"
	"sync"
)

var (
	// Precompiled and cached regexes
	regexCache   = make(map[string]*regexp.Regexp)
	regexCacheMu = &sync.RWMutex{}

	// Preprocessed lowercase patterns (to avoid repeated ToLower)
	untrustedPatternsLower []string
)

func init() {
	for _, p := range UntrustedEventSources.EnvValueContainsIssueOrPR {
		untrustedPatternsLower = append(untrustedPatternsLower, strings.ToLower(p))
	}
	for _, p := range UntrustedEventSources.EnvValueContainsCommit {
		untrustedPatternsLower = append(untrustedPatternsLower, strings.ToLower(p))
	}
}

// fileContainsAnySecretName checks if file contains any high privilege secrets.
func fileContainsAnySecretName(content string, secrets []string) []string {
	contentLower := strings.ToLower(content)
	var found []string
	for _, secret := range secrets {
		if strings.Contains(contentLower, strings.ToLower(secret)) {
			found = append(found, secret)
		}
	}
	return found
}

// fileContainsAllSecretNames checks if file contains all specified secrets.
func fileContainsAllSecretNames(content string, secrets []string) bool {
	contentLower := strings.ToLower(content)
	for _, secret := range secrets {
		if !strings.Contains(contentLower, strings.ToLower(secret)) {
			return false
		}
	}
	return true
}

// detectAIAgent detects if step uses specified AI Agents.
func detectAIAgent(step WorkflowStep, agents map[string]AIAgent) (string, *AIAgent) {
	stepText := strings.ToLower(step.Uses + " " + step.Name + " " + step.Run)
	for key, agent := range agents {
		for _, identifier := range agent.Identifiers {
			if strings.Contains(stepText, strings.ToLower(identifier)) {
				return key, &agent
			}
		}
	}
	return "", nil
}

// detectAnyAIAgent detects if file content mentions any AI Agent.
func detectAnyAIAgent(content string, agents map[string]AIAgent) (string, *AIAgent) {
	contentLower := strings.ToLower(content)
	for key, agent := range agents {
		for _, identifier := range agent.Identifiers {
			if strings.Contains(contentLower, strings.ToLower(identifier)) {
				return key, &agent
			}
		}
	}
	return "", nil
}

// collectEnv merges workflow/job/step level env.
func collectEnv(workflowEnv, jobEnv, stepEnv map[string]string) map[string]string {
	merged := make(map[string]string)
	for k, v := range workflowEnv {
		merged[k] = v
	}
	for k, v := range jobEnv {
		merged[k] = v
	}
	for k, v := range stepEnv {
		merged[k] = v
	}
	return merged
}

// classifyUntrustedEnv identifies which env variables come from untrusted sources.
func classifyUntrustedEnv(env map[string]string) map[string]string {
	untrusted := make(map[string]string)
	for k, v := range env {
		vLower := strings.ToLower(v)
		for _, pattern := range untrustedPatternsLower {
			if strings.Contains(vLower, pattern) {
				untrusted[k] = v
				break
			}
		}
	}
	return untrusted
}

// promptContainsUntrustedDirect checks if prompt directly contains untrusted event fields.
func promptContainsUntrustedDirect(prompt string) []string {
	promptLower := strings.ToLower(prompt)
	var found []string
	for _, field := range UntrustedEventSources.DirectPromptFields {
		if strings.Contains(promptLower, strings.ToLower(field)) {
			found = append(found, field)
		}
	}
	return found
}

// promptUsesUntrustedEnv checks if prompt references untrusted env variables.
func promptUsesUntrustedEnv(prompt string, untrustedEnv map[string]string) []string {
	promptLower := strings.ToLower(prompt)
	var found []string
	for k := range untrustedEnv {
		// Check ${{ env.VAR }} or ${VAR} or $VAR formats
		patterns := []string{
			strings.ToLower("${{ env." + k),
			strings.ToLower("${" + k + "}"),
			strings.ToLower("$" + k),
			strings.ToLower(k), // Direct reference variable name
		}
		for _, p := range patterns {
			if strings.Contains(promptLower, p) {
				found = append(found, k)
				break
			}
		}
	}
	return found
}

// getOrCompileRegex retrieves or compiles regex (with cache).
func getOrCompileRegex(pattern string) *regexp.Regexp {
	regexCacheMu.RLock()
	re, ok := regexCache[pattern]
	regexCacheMu.RUnlock()
	if ok {
		return re
	}

	regexCacheMu.Lock()
	defer regexCacheMu.Unlock()
	// Double check
	if re, ok = regexCache[pattern]; ok {
		return re
	}
	re = regexp.MustCompile(pattern)
	regexCache[pattern] = re
	return re
}

// fileHasKeyValueExact checks if file contains exact key: value.
func fileHasKeyValueExact(content, key, value string) (bool, int) {
	lines := strings.Split(content, "\n")
	pattern := `(?i)^\s*` + regexp.QuoteMeta(key) + `\s*:\s*["']?` + regexp.QuoteMeta(value) + `["']?\s*$`
	keyPattern := getOrCompileRegex(pattern)
	for i, line := range lines {
		if keyPattern.MatchString(line) {
			return true, i + 1
		}
	}
	return false, 0
}

// fileHasKeyWithValueNotEqual checks if file contains key with value not equal to safeDefault.
func fileHasKeyWithValueNotEqual(content, key, safeDefault string) (bool, string, int) {
	lines := strings.Split(content, "\n")
	pattern := `(?i)^\s*` + regexp.QuoteMeta(key) + `\s*:\s*["']?([^"'\s]+)["']?\s*$`
	keyPattern := getOrCompileRegex(pattern)
	for i, line := range lines {
		matches := keyPattern.FindStringSubmatch(line)
		if len(matches) > 1 {
			actualValue := matches[1]
			if !strings.EqualFold(actualValue, safeDefault) {
				return true, actualValue, i + 1
			}
		}
	}
	return false, "", 0
}

// fileContainsPrivilegedToolsSignature checks if file contains privileged tool signatures.
func fileContainsPrivilegedToolsSignature(content string) bool {
	contentLower := strings.ToLower(content)
	for _, sig := range PrivilegedToolsSignature.MustContainAll {
		if !strings.Contains(contentLower, strings.ToLower(sig)) {
			return false
		}
	}
	return true
}

// getPromptFromStep extracts prompt from step.
func getPromptFromStep(step WorkflowStep) string {
	if prompt, ok := step.With["prompt"]; ok {
		return prompt
	}
	// Also check other possible prompt fields
	for k, v := range step.With {
		kLower := strings.ToLower(k)
		if strings.Contains(kLower, "prompt") || strings.Contains(kLower, "message") || strings.Contains(kLower, "input") {
			return v
		}
	}
	if strings.TrimSpace(step.Run) != "" {
		return step.Run
	}
	return ""
}
