package yamlscan

import (
	"fmt"
)

// scanRule1CorePattern Rule 1: PromptPwnd Core Pattern
func scanRule1CorePattern(content string, workflow *WorkflowFile) []Finding {
	var findings []Finding
	rule := BuiltinRules[0] // PromptPwnd-CorePattern

	// Check for high privilege secrets
	foundSecrets := fileContainsAnySecretName(content, HighPrivilegeSecrets)
	if len(foundSecrets) == 0 {
		return findings
	}

	// Iterate over jobs and steps
	for jobName, job := range workflow.Jobs {
		for stepIdx, step := range job.Steps {
			// Check if AI Agent is used
			agentKey, agent := detectAIAgent(step, AIAgents)
			if agent == nil {
				continue
			}

			// Collect env
			mergedEnv := collectEnv(workflow.Env, job.Env, step.Env)
			untrustedEnv := classifyUntrustedEnv(mergedEnv)

			// Get prompt
			prompt := getPromptFromStep(step)
			
			// Check if prompt uses untrusted input
			directUntrusted := promptContainsUntrustedDirect(prompt)
			envUntrusted := promptUsesUntrustedEnv(prompt, untrustedEnv)

			if len(directUntrusted) > 0 || len(envUntrusted) > 0 {
				// Use make to avoid modifying original slice
				matched := make([]string, 0, len(directUntrusted)+len(envUntrusted)+len(foundSecrets))
				matched = append(matched, directUntrusted...)
				matched = append(matched, envUntrusted...)
				matched = append(matched, foundSecrets...)
				findings = append(findings, Finding{
					Line:        0,
					RuleID:      rule.ID,
					Matched:     matched,
					Context:     fmt.Sprintf("Job: %s, Step: %d (%s), Agent: %s", jobName, stepIdx+1, step.Name, agentKey),
					Severity:    rule.Severity,
					Category:    rule.Category,
					Description: rule.Description,
					Suggestion:  rule.Suggestion,
				})
			}
		}
	}
	return findings
}

// scanRule2GeminiCLI Rule 2: Gemini CLI Case Study
func scanRule2GeminiCLI(content string, workflow *WorkflowFile) []Finding {
	var findings []Finding
	rule := BuiltinRules[1] // PromptPwnd-GeminiCLI-CaseStudy

	// Prerequisite: File contains privileged tool signature
	if !fileContainsPrivilegedToolsSignature(content) {
		return findings
	}

	// Prerequisite: All three secrets present
	requiredSecrets := []string{"GEMINI_API_KEY", "GOOGLE_CLOUD_ACCESS_TOKEN", "GITHUB_TOKEN"}
	if !fileContainsAllSecretNames(content, requiredSecrets) {
		return findings
	}

	geminiAgent := AIAgents["gemini_cli"]

	for jobName, job := range workflow.Jobs {
		for stepIdx, step := range job.Steps {
			// Must be Gemini CLI
			agentKey, _ := detectAIAgent(step, map[string]AIAgent{"gemini_cli": geminiAgent})
			if agentKey != "gemini_cli" {
				continue
			}

			// Check if env contains issue variables
			mergedEnv := collectEnv(workflow.Env, job.Env, step.Env)
			untrustedEnv := classifyUntrustedEnv(mergedEnv)
			if len(untrustedEnv) == 0 {
				continue
			}

			// Check if prompt references these env variables
			prompt := getPromptFromStep(step)
			envUsed := promptUsesUntrustedEnv(prompt, untrustedEnv)
			if len(envUsed) > 0 {
				// Use make to avoid modifying original slice
				matched := make([]string, 0, len(envUsed)+len(requiredSecrets)+2)
				matched = append(matched, envUsed...)
				matched = append(matched, requiredSecrets...)
				matched = append(matched, "coreTools", "gh issue")
				findings = append(findings, Finding{
					Line:        0,
					RuleID:      rule.ID,
					Matched:     matched,
					Context:     fmt.Sprintf("Job: %s, Step: %d (%s)", jobName, stepIdx+1, step.Name),
					Severity:    rule.Severity,
					Category:    rule.Category,
					Description: rule.Description,
					Suggestion:  rule.Suggestion,
				})
			}
		}
	}
	return findings
}

// scanRule3ClaudeMisconfig Rule 3: Claude Code Actions Misconfiguration
func scanRule3ClaudeMisconfig(content string) []Finding {
	var findings []Finding
	rule := BuiltinRules[2] // ClaudeCode-allowed_non_write_users-star

	// Check if Claude Code Actions is mentioned
	agentKey, _ := detectAnyAIAgent(content, map[string]AIAgent{"claude_code_actions": AIAgents["claude_code_actions"]})
	if agentKey == "" {
		return findings
	}

	// Check allowed_non_write_users: "*"
	sig := MisconfigSignatures.ClaudeAllowedNonWriteUsersStar
	if found, line := fileHasKeyValueExact(content, sig.Key, sig.Value); found {
		findings = append(findings, Finding{
			Line:        line,
			RuleID:      rule.ID,
			Matched:     []string{sig.Key + ": " + sig.Value},
			Context:     fmt.Sprintf("Line %d: %s: \"%s\"", line, sig.Key, sig.Value),
			Severity:    rule.Severity,
			Category:    rule.Category,
			Description: rule.Description,
			Suggestion:  rule.Suggestion,
		})
	}
	return findings
}

// scanRule4CodexMisconfig Rule 4: OpenAI Codex Actions Misconfiguration
func scanRule4CodexMisconfig(content string) []Finding {
	var findings []Finding
	rule := BuiltinRules[3] // Codex-allow-users-star-and-unsafe-safety-strategy

	// Check if Codex Actions is mentioned
	agentKey, _ := detectAnyAIAgent(content, map[string]AIAgent{"openai_codex_actions": AIAgents["openai_codex_actions"]})
	if agentKey == "" {
		return findings
	}

	// Check allow-users: "*"
	sig1 := MisconfigSignatures.CodexAllowUsersStar
	allowUsersFound, line1 := fileHasKeyValueExact(content, sig1.Key, sig1.Value)

	// Check safety-strategy != "drop-sudo"
	sig2 := MisconfigSignatures.CodexSafetyStrategy
	safetyUnsafe, actualValue, line2 := fileHasKeyWithValueNotEqual(content, sig2.Key, sig2.SafeDefault)

	// Report only if both conditions are met
	if allowUsersFound && safetyUnsafe {
		findings = append(findings, Finding{
			Line:        line1,
			RuleID:      rule.ID,
			Matched:     []string{sig1.Key + ": " + sig1.Value, sig2.Key + ": " + actualValue},
			Context:     fmt.Sprintf("Line %d: %s: \"%s\", Line %d: %s: \"%s\"", line1, sig1.Key, sig1.Value, line2, sig2.Key, actualValue),
			Severity:    rule.Severity,
			Category:    rule.Category,
			Description: rule.Description,
			Suggestion:  rule.Suggestion,
		})
	}
	return findings
}

// scanRule5GitHubAIMisconfig Rule 5: GitHub AI Inference Misconfiguration
func scanRule5GitHubAIMisconfig(content string) []Finding {
	var findings []Finding
	rule := BuiltinRules[4] // GitHubAIInference-enable-github-mcp-true

	// Check if GitHub AI Inference is mentioned
	agentKey, _ := detectAnyAIAgent(content, map[string]AIAgent{"github_ai_inference": AIAgents["github_ai_inference"]})
	if agentKey == "" {
		return findings
	}

	// Check enable-github-mcp: true
	sig := MisconfigSignatures.GitHubAIInferenceMCP
	if found, line := fileHasKeyValueExact(content, sig.Key, sig.Value); found {
		findings = append(findings, Finding{
			Line:        line,
			RuleID:      rule.ID,
			Matched:     []string{sig.Key + ": " + sig.Value},
			Context:     fmt.Sprintf("Line %d: %s: %s", line, sig.Key, sig.Value),
			Severity:    rule.Severity,
			Category:    rule.Category,
			Description: rule.Description,
			Suggestion:  rule.Suggestion,
		})
	}
	return findings
}
