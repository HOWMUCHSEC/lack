package nucleiscan

import (
	"context"
	"net"
	"strings"
	"testing"
)

func TestNormalizePortScanConfig_Defaults(t *testing.T) {
	cfg, err := normalizePortScanConfig(PortScanConfig{Target: "127.0.0.1"})
	if err != nil {
		t.Fatalf("expected defaults to be applied, got %v", err)
	}
	if cfg.Profile != PortScanProfileAI {
		t.Fatalf("expected default profile %q, got %q", PortScanProfileAI, cfg.Profile)
	}
	if len(cfg.Ports) != len(aiServicePorts) {
		t.Fatalf("expected default AI service ports, got %d", len(cfg.Ports))
	}
	if cfg.Timeout != defaultPortScanTimeoutMS {
		t.Fatalf("expected default timeout %d, got %d", defaultPortScanTimeoutMS, cfg.Timeout)
	}
	if cfg.Concurrency != defaultPortScanConcurrency {
		t.Fatalf("expected default concurrency %d, got %d", defaultPortScanConcurrency, cfg.Concurrency)
	}
}

func TestNormalizePortScanConfig_Profiles(t *testing.T) {
	webCfg, err := normalizePortScanConfig(PortScanConfig{Target: "127.0.0.1", Profile: PortScanProfileWeb})
	if err != nil {
		t.Fatalf("expected web profile to normalize, got %v", err)
	}
	if !hasPort(webCfg.Ports, 9443) {
		t.Fatal("expected web profile to include HTTPS alternate port 9443")
	}
	if hasPort(webCfg.Ports, 11434) {
		t.Fatal("did not expect web profile to include Ollama port 11434")
	}

	allCfg, err := normalizePortScanConfig(PortScanConfig{Target: "127.0.0.1", Profile: PortScanProfileAll})
	if err != nil {
		t.Fatalf("expected all profile to normalize, got %v", err)
	}
	if !hasPort(allCfg.Ports, 9443) || !hasPort(allCfg.Ports, 11434) {
		t.Fatal("expected all profile to include both web and AI ports")
	}

	customCfg, err := normalizePortScanConfig(PortScanConfig{
		Target:  "127.0.0.1",
		Profile: PortScanProfileCustom,
		Ports:   []int{8080, 80, 8080},
	})
	if err != nil {
		t.Fatalf("expected custom profile to normalize, got %v", err)
	}
	if got, want := customCfg.Ports, []int{80, 8080}; !samePorts(got, want) {
		t.Fatalf("expected custom ports %v, got %v", want, got)
	}
}

func TestRecommendedTargetsForOpenPorts(t *testing.T) {
	ports := []PortInfo{
		{Port: 443, RecommendedURLs: recommendedURLsForPort("example.com", 443)},
		{Port: 6379, RecommendedURLs: recommendedURLsForPort("example.com", 6379)},
		{Port: 11434, RecommendedURLs: recommendedURLsForPort("example.com", 11434)},
		{Port: 12345, RecommendedURLs: recommendedURLsForPort("example.com", 12345)},
	}

	targets := recommendedTargetsForOpenPorts("example.com", ports)
	want := []string{
		"https://example.com:443",
		"http://example.com:11434",
		"http://example.com:12345",
		"https://example.com:12345",
	}
	if !sameStrings(targets, want) {
		t.Fatalf("expected recommended targets %v, got %v", want, targets)
	}
}

func TestScanPortsCarriesTaskIDToResultAndEvents(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen on local port: %v", err)
	}
	defer listener.Close()

	go func() {
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		_ = conn.Close()
	}()

	port := listener.Addr().(*net.TCPAddr).Port
	var found []PortInfo
	result, err := ScanPorts(context.Background(), PortScanConfig{
		TaskID:      "task-1",
		Target:      "127.0.0.1",
		Ports:       []int{port},
		Timeout:     1000,
		Concurrency: 1,
	}, func(info PortInfo) {
		found = append(found, info)
	})
	if err != nil {
		t.Fatalf("scan ports: %v", err)
	}

	if result.TaskID != "task-1" {
		t.Fatalf("expected result taskID task-1, got %q", result.TaskID)
	}
	if len(result.OpenPorts) != 1 {
		t.Fatalf("expected one open port, got %d", len(result.OpenPorts))
	}
	if len(result.RecommendedTargets) == 0 {
		t.Fatal("expected scan result to include recommended targets")
	}
	if result.OpenPorts[0].TaskID != "task-1" {
		t.Fatalf("expected open port taskID task-1, got %q", result.OpenPorts[0].TaskID)
	}
	if len(found) != 1 {
		t.Fatalf("expected one found port event, got %d", len(found))
	}
	if found[0].TaskID != "task-1" {
		t.Fatalf("expected found port taskID task-1, got %q", found[0].TaskID)
	}
}

func TestNormalizePortScanConfig_RejectsUnsafeValues(t *testing.T) {
	tooManyPorts := make([]int, maxPortScanPorts+1)
	for i := range tooManyPorts {
		tooManyPorts[i] = 80
	}

	cases := []struct {
		name string
		cfg  PortScanConfig
		want string
	}{
		{
			name: "missing target",
			cfg:  PortScanConfig{},
			want: "target is required",
		},
		{
			name: "too many ports",
			cfg:  PortScanConfig{Target: "127.0.0.1", Profile: PortScanProfileCustom, Ports: tooManyPorts},
			want: "too many ports",
		},
		{
			name: "port below range",
			cfg:  PortScanConfig{Target: "127.0.0.1", Ports: []int{0}},
			want: "outside valid TCP port range",
		},
		{
			name: "port above range",
			cfg:  PortScanConfig{Target: "127.0.0.1", Ports: []int{maxTCPPort + 1}},
			want: "outside valid TCP port range",
		},
		{
			name: "unknown profile",
			cfg:  PortScanConfig{Target: "127.0.0.1", Profile: "disabled-web"},
			want: "unknown port scan profile",
		},
		{
			name: "custom profile without ports",
			cfg:  PortScanConfig{Target: "127.0.0.1", Profile: PortScanProfileCustom},
			want: "custom port scan profile requires at least one port",
		},
		{
			name: "negative timeout",
			cfg:  PortScanConfig{Target: "127.0.0.1", Timeout: -1},
			want: "timeout must be non-negative",
		},
		{
			name: "timeout over hard limit",
			cfg:  PortScanConfig{Target: "127.0.0.1", Timeout: maxPortScanTimeoutMS + 1},
			want: "timeout exceeds hard limit",
		},
		{
			name: "negative concurrency",
			cfg:  PortScanConfig{Target: "127.0.0.1", Concurrency: -1},
			want: "concurrency must be non-negative",
		},
		{
			name: "concurrency over hard limit",
			cfg:  PortScanConfig{Target: "127.0.0.1", Concurrency: maxPortScanConcurrency + 1},
			want: "concurrency exceeds hard limit",
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			_, err := normalizePortScanConfig(tt.cfg)
			if err == nil {
				t.Fatalf("expected validation error containing %q", tt.want)
			}
			if !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("expected validation error containing %q, got %v", tt.want, err)
			}
		})
	}
}

func hasPort(ports []int, want int) bool {
	for _, port := range ports {
		if port == want {
			return true
		}
	}
	return false
}

func samePorts(got, want []int) bool {
	if len(got) != len(want) {
		return false
	}
	for i := range got {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}

func sameStrings(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	for i := range got {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}
