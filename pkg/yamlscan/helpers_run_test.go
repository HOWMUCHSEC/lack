package yamlscan

import "testing"

func TestRunCommandIsDetectedAsAIAgentPrompt(t *testing.T) {
	step := WorkflowStep{
		Name: "Ask Gemini",
		Run:  `gemini-cli --prompt "${{ github.event.issue.body }}"`,
	}

	agentKey, agent := detectAIAgent(step, map[string]AIAgent{"gemini_cli": AIAgents["gemini_cli"]})
	if agent == nil || agentKey != "gemini_cli" {
		t.Fatalf("expected gemini_cli detection, got key=%q agent=%v", agentKey, agent)
	}

	prompt := getPromptFromStep(step)
	if prompt == "" {
		t.Fatal("expected run command to be treated as prompt text")
	}
	if got := promptContainsUntrustedDirect(prompt); len(got) == 0 {
		t.Fatal("expected direct untrusted GitHub event reference to be detected")
	}
}
