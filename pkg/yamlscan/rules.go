package yamlscan

// ================================================================================
// Common Dictionary Definition - Based on Aikido PromptPwnd Article
// https://www.aikido.dev/blog/promptpwnd-github-actions-ai-agents
// ================================================================================

// AIAgent defines an AI Agent.
type AIAgent struct {
	Key         string   `json:"key"`
	Description string   `json:"description"`
	Identifiers []string `json:"identifiers"` // Identifiers used for matching
}

// Rule defines a scanning rule.
type Rule struct {
	ID          string `json:"id"`
	Severity    string `json:"severity"`    // critical / high / medium / low
	Category    string `json:"category"`    // promptpwnd / misconfig
	Description string `json:"description"` // Rule description
	Suggestion  string `json:"suggestion"`  // Remediation suggestion
}

// 1) AI Agents: The 4 types explicitly named in the article
var AIAgents = map[string]AIAgent{
	"gemini_cli": {
		Key:         "gemini_cli",
		Description: "Google Gemini CLI GitHub Action",
		Identifiers: []string{
			"google-github-actions/run-gemini-cli",
			"gemini cli",
			"gemini-cli",
		},
	},
	"claude_code_actions": {
		Key:         "claude_code_actions",
		Description: "Anthropic Claude Code Actions",
		Identifiers: []string{
			"anthropics/claude-code-action",
			"claude code actions",
			"claude-code-action",
		},
	},
	"openai_codex_actions": {
		Key:         "openai_codex_actions",
		Description: "OpenAI Codex Actions",
		Identifiers: []string{
			"openai/codex-action",
			"openai codex actions",
			"codex-action",
		},
	},
	"github_ai_inference": {
		Key:         "github_ai_inference",
		Description: "GitHub AI Inference",
		Identifiers: []string{
			"actions/ai-inference",
			"github ai inference",
			"ai-inference",
		},
	},
}

// 2) Untrusted user input sources
var UntrustedEventSources = struct {
	DirectPromptFields        []string // Event fields appearing directly in prompt
	EnvValueContainsIssueOrPR []string // Env value contains issue/PR related content
	EnvValueContainsCommit    []string // Env value contains commit related content
}{
	DirectPromptFields: []string{
		"github.event.issue.title",
		"github.event.issue.body",
		"github.event.pull_request.title",
		"github.event.pull_request.body",
		"github.event.comment.body",
	},
	EnvValueContainsIssueOrPR: []string{
		"github.event.issue.",
		"github.event.pull_request.",
		"github.event.comment.",
	},
	EnvValueContainsCommit: []string{
		"github.event.head_commit.",
		"github.event.commits",
	},
}

// 3) High privilege secrets
var HighPrivilegeSecrets = []string{
	"GITHUB_TOKEN",
	"GEMINI_API_KEY",
	"GOOGLE_CLOUD_ACCESS_TOKEN",
	"ANTHROPIC_API_KEY",
	"OPENAI_API_KEY",
}

// 4) Privileged tool signatures (coreTools in Gemini CLI case)
var PrivilegedToolsSignature = struct {
	MustContainAll []string
}{
	MustContainAll: []string{
		"coreTools",
		"run_shell_command(",
		"gh issue",
	},
}

// 5) Misconfiguration signatures
var MisconfigSignatures = struct {
	ClaudeAllowedNonWriteUsersStar struct {
		Key   string
		Value string
	}
	CodexAllowUsersStar struct {
		Key   string
		Value string
	}
	CodexSafetyStrategy struct {
		Key         string
		SafeDefault string
	}
	GitHubAIInferenceMCP struct {
		Key   string
		Value string
	}
}{
	ClaudeAllowedNonWriteUsersStar: struct {
		Key   string
		Value string
	}{
		Key:   "allowed_non_write_users",
		Value: "*",
	},
	CodexAllowUsersStar: struct {
		Key   string
		Value string
	}{
		Key:   "allow-users",
		Value: "*",
	},
	CodexSafetyStrategy: struct {
		Key         string
		SafeDefault string
	}{
		Key:         "safety-strategy",
		SafeDefault: "drop-sudo",
	},
	GitHubAIInferenceMCP: struct {
		Key   string
		Value string
	}{
		Key:   "enable-github-mcp",
		Value: "true",
	},
}

// ================================================================================
// 5 Scanning Rules Definition
// ================================================================================

var BuiltinRules = []Rule{
	// Rule 1: PromptPwnd Core Pattern
	{
		ID:       "PromptPwnd-CorePattern",
		Severity: "high",
		Category: "promptpwnd",
		Description: "AI Agent directly or indirectly uses untrusted issue/PR/commit content in prompt, " +
			"and high privilege secrets exist in the workflow file",
		Suggestion: "Avoid passing user-controlled issue/PR/commit content directly to AI Agent prompt, " +
			"or use input filtering and sandboxing",
	},
	// Rule 2: Gemini CLI Case Study
	{
		ID:       "PromptPwnd-GeminiCLI-CaseStudy",
		Severity: "critical",
		Category: "promptpwnd",
		Description: "Matches Google Gemini CLI vulnerability case: issue content enters prompt via env, " +
			"and exposes GEMINI_API_KEY, GOOGLE_CLOUD_ACCESS_TOKEN, GITHUB_TOKEN, " +
			"and configures gh issue command in coreTools",
		Suggestion: "Remove direct reference to issue content in prompt, restrict coreTools permissions, " +
			"avoid exposing multiple high privilege credentials simultaneously",
	},
	// Rule 3: Claude Code Actions Misconfiguration
	{
		ID:       "ClaudeCode-allowed_non_write_users-star",
		Severity: "critical",
		Category: "misconfig",
		Description: "Claude Code Actions sets allowed_non_write_users: \"*\", " +
			"removing the protection boundary that only allows users with write permissions to trigger",
		Suggestion: "Remove allowed_non_write_users: \"*\" configuration, keep default write permission requirement",
	},
	// Rule 4: OpenAI Codex Actions Misconfiguration
	{
		ID:       "Codex-allow-users-star-and-unsafe-safety-strategy",
		Severity: "critical",
		Category: "misconfig",
		Description: "OpenAI Codex Actions sets allow-users: \"*\" and safety-strategy " +
			"is not the safe default \"drop-sudo\", removing user permission boundaries and safety policies",
		Suggestion: "Remove allow-users: \"*\", and ensure safety-strategy is set to \"drop-sudo\"",
	},
	// Rule 5: GitHub AI Inference Misconfiguration
	{
		ID:       "GitHubAIInference-enable-github-mcp-true",
		Severity: "high",
		Category: "misconfig",
		Description: "GitHub AI Inference enables enable-github-mcp: true, " +
			"allowing AI to interact with high privilege GitHub tokens via MCP server",
		Suggestion: "Do not enable enable-github-mcp unless necessary, or ensure appropriate prompt filtering",
	},
}

// GetBuiltinRules returns all builtin rules.
func GetBuiltinRules() []Rule {
	return BuiltinRules
}

// GetAIAgents returns all AI Agents.
func GetAIAgents() map[string]AIAgent {
	return AIAgents
}
