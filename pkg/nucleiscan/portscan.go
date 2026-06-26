package nucleiscan

import (
	"context"
	"fmt"
	"net"
	"sort"
	"strings"
	"sync"
	"time"

	"lack-client/pkg/logger"
)

const (
	defaultPortScanTimeoutMS   = 1000
	defaultPortScanConcurrency = 50
	maxPortScanPorts           = 1024
	maxPortScanConcurrency     = 500
	maxPortScanTimeoutMS       = 10000
	minTCPPort                 = 1
	maxTCPPort                 = 65535
)

const (
	PortScanProfileAI     = "ai"
	PortScanProfileWeb    = "web"
	PortScanProfileAll    = "all"
	PortScanProfileCustom = "custom"
)

// PortInfo port information.
type PortInfo struct {
	TaskID          string   `json:"taskID"`
	Port            int      `json:"port"`
	Protocol        string   `json:"protocol"`
	Service         string   `json:"service"`
	Status          string   `json:"status"` // open, closed
	RecommendedURLs []string `json:"recommendedURLs,omitempty"`
}

// PortScanConfig port scan configuration.
type PortScanConfig struct {
	TaskID      string `json:"taskID"`      // Task ID
	Target      string `json:"target"`      // Target host
	Profile     string `json:"profile"`     // Port profile: ai, web, all, custom
	Ports       []int  `json:"ports"`       // List of ports (empty uses default AI service ports)
	Timeout     int    `json:"timeout"`     // Timeout per port in milliseconds
	Concurrency int    `json:"concurrency"` // Concurrency level
}

// PortScanResult port scan result.
type PortScanResult struct {
	TaskID             string     `json:"taskID"`
	Target             string     `json:"target"`
	Profile            string     `json:"profile"`
	OpenPorts          []PortInfo `json:"openPorts"`
	RecommendedTargets []string   `json:"recommendedTargets"`
	StartedAt          int64      `json:"startedAt"`
	FinishedAt         int64      `json:"finishedAt"`
}

type portDefinition struct {
	service  string
	category string
	schemes  []string
	profiles []string
}

// portCatalog is the structured source of truth for profile expansion and URL recommendations.
var portCatalog = map[int]portDefinition{
	// General web entry points.
	80:    {service: "HTTP", category: "web", schemes: []string{"http"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	81:    {service: "HTTP-Alt", category: "web", schemes: []string{"http"}, profiles: []string{PortScanProfileWeb}},
	443:   {service: "HTTPS", category: "web", schemes: []string{"https"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	7001:  {service: "WebLogic/HTTP", category: "web", schemes: []string{"http"}, profiles: []string{PortScanProfileWeb}},
	7002:  {service: "WebLogic/HTTPS", category: "web", schemes: []string{"https"}, profiles: []string{PortScanProfileWeb}},
	8008:  {service: "HTTP-Alt", category: "web", schemes: []string{"http"}, profiles: []string{PortScanProfileWeb}},
	8082:  {service: "HTTP-Alt", category: "web", schemes: []string{"http"}, profiles: []string{PortScanProfileWeb}},
	8088:  {service: "YARN/Ray/HTTP", category: "web", schemes: []string{"http"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	8443:  {service: "HTTPS-Alt", category: "web", schemes: []string{"https"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	9080:  {service: "HTTP-Alt", category: "web", schemes: []string{"http"}, profiles: []string{PortScanProfileWeb}},
	9443:  {service: "HTTPS-Alt", category: "web", schemes: []string{"https"}, profiles: []string{PortScanProfileWeb}},
	10000: {service: "Webmin/HTTP", category: "web", schemes: []string{"http", "https"}, profiles: []string{PortScanProfileWeb}},
	10443: {service: "HTTPS-Alt", category: "web", schemes: []string{"https"}, profiles: []string{PortScanProfileWeb}},

	// Vector databases and data stores commonly found in AI stacks.
	6333:  {service: "Qdrant", category: "vector-db", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	6334:  {service: "Qdrant-gRPC", category: "vector-db", profiles: []string{PortScanProfileAI}},
	19530: {service: "Milvus", category: "vector-db", profiles: []string{PortScanProfileAI}},
	19121: {service: "Milvus-gRPC", category: "vector-db", profiles: []string{PortScanProfileAI}},
	8000:  {service: "Chroma/FastAPI", category: "vector-db", schemes: []string{"http"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	6379:  {service: "Redis/Dragonfly", category: "data-store", profiles: []string{PortScanProfileAI}},
	9200:  {service: "Elasticsearch/OpenSearch", category: "data-store", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	5601:  {service: "Kibana", category: "data-store", schemes: []string{"http"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	7474:  {service: "Neo4j Browser", category: "data-store", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	7687:  {service: "Neo4j Bolt", category: "data-store", profiles: []string{PortScanProfileAI}},
	27017: {service: "MongoDB", category: "data-store", profiles: []string{PortScanProfileAI}},
	27018: {service: "MongoDB-Alt", category: "data-store", profiles: []string{PortScanProfileAI}},

	// LLM services and AI application frontends.
	11434: {service: "Ollama", category: "llm-service", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	8080:  {service: "Weaviate/Airflow/HTTP", category: "llm-service", schemes: []string{"http"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	8081:  {service: "LocalAI/HTTP", category: "llm-service", schemes: []string{"http"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	5000:  {service: "vLLM/Dify API", category: "llm-service", schemes: []string{"http"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	3000:  {service: "LiteLLM/OpenWebUI/Grafana", category: "llm-service", schemes: []string{"http"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	3001:  {service: "OpenWebUI/Next.js", category: "llm-service", schemes: []string{"http"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	8265:  {service: "Ray Dashboard", category: "llm-service", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	8188:  {service: "ComfyUI", category: "llm-service", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	7860:  {service: "Gradio/Stable Diffusion/Langflow", category: "llm-service", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	7861:  {service: "Gradio-Alt", category: "llm-service", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	7862:  {service: "Gradio-Alt", category: "llm-service", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},

	// ML frameworks, MLOps, and observability.
	8501:  {service: "TensorFlow/Streamlit", category: "ml-framework", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	8500:  {service: "TensorFlow-gRPC", category: "ml-framework", profiles: []string{PortScanProfileAI}},
	8085:  {service: "Triton-HTTP", category: "ml-framework", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	8001:  {service: "Triton-gRPC", category: "ml-framework", profiles: []string{PortScanProfileAI}},
	9000:  {service: "MinIO API", category: "ml-framework", schemes: []string{"http"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	9001:  {service: "MinIO Console", category: "ml-framework", schemes: []string{"http"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	8888:  {service: "Jupyter", category: "ml-framework", schemes: []string{"http"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	8889:  {service: "Jupyter-Alt", category: "ml-framework", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	6006:  {service: "TensorBoard", category: "ml-framework", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	5001:  {service: "MLflow", category: "ml-framework", schemes: []string{"http"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	4040:  {service: "Spark-UI", category: "ml-framework", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	7077:  {service: "Spark Master", category: "ml-framework", profiles: []string{PortScanProfileAI}},
	18080: {service: "Spark History", category: "ml-framework", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	9090:  {service: "Prometheus", category: "observability", schemes: []string{"http"}, profiles: []string{PortScanProfileAI, PortScanProfileWeb}},
	9091:  {service: "Prometheus Pushgateway", category: "observability", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
	9093:  {service: "Alertmanager", category: "observability", schemes: []string{"http"}, profiles: []string{PortScanProfileAI}},
}

// Port map for common AI services. Kept for internal compatibility with older tests/helpers.
var aiServicePorts = buildServicePortMap(PortScanProfileAI)

// getDefaultAIPorts gets the list of default AI service ports.
func getDefaultAIPorts() []int {
	return getPortsForProfile(PortScanProfileAI)
}

// getServiceName gets service name by port.
func getServiceName(port int) string {
	if def, ok := portCatalog[port]; ok {
		return def.service
	}
	return "Unknown"
}

func buildServicePortMap(profile string) map[int]string {
	ports := make(map[int]string)
	for port, def := range portCatalog {
		if profile == PortScanProfileAll || containsString(def.profiles, profile) {
			ports[port] = def.service
		}
	}
	return ports
}

func getPortsForProfile(profile string) []int {
	ports := make([]int, 0, len(portCatalog))
	for port, def := range portCatalog {
		if profile == PortScanProfileAll || containsString(def.profiles, profile) {
			ports = append(ports, port)
		}
	}
	sort.Ints(ports)
	return ports
}

func isKnownPortScanProfile(profile string) bool {
	switch profile {
	case PortScanProfileAI, PortScanProfileWeb, PortScanProfileAll, PortScanProfileCustom:
		return true
	default:
		return false
	}
}

func containsString(values []string, needle string) bool {
	for _, value := range values {
		if value == needle {
			return true
		}
	}
	return false
}

func normalizePorts(ports []int) ([]int, error) {
	seen := make(map[int]struct{}, len(ports))
	normalized := make([]int, 0, len(ports))
	for _, port := range ports {
		if port < minTCPPort || port > maxTCPPort {
			return nil, fmt.Errorf("port %d is outside valid TCP port range %d-%d", port, minTCPPort, maxTCPPort)
		}
		if _, ok := seen[port]; ok {
			continue
		}
		seen[port] = struct{}{}
		normalized = append(normalized, port)
	}
	sort.Ints(normalized)
	return normalized, nil
}

func normalizePortScanConfig(cfg PortScanConfig) (PortScanConfig, error) {
	if cfg.Target == "" {
		return cfg, fmt.Errorf("target is required")
	}

	cfg.Target = strings.TrimSpace(cfg.Target)
	if cfg.Target == "" {
		return cfg, fmt.Errorf("target is required")
	}

	cfg.Profile = strings.TrimSpace(cfg.Profile)
	if cfg.Profile == "" {
		if len(cfg.Ports) > 0 {
			cfg.Profile = PortScanProfileCustom
		} else {
			cfg.Profile = PortScanProfileAI
		}
	}
	if !isKnownPortScanProfile(cfg.Profile) {
		return cfg, fmt.Errorf("unknown port scan profile %q", cfg.Profile)
	}

	if len(cfg.Ports) == 0 {
		if cfg.Profile == PortScanProfileCustom {
			return cfg, fmt.Errorf("custom port scan profile requires at least one port")
		}
		cfg.Ports = getPortsForProfile(cfg.Profile)
	}
	if len(cfg.Ports) > maxPortScanPorts {
		return cfg, fmt.Errorf("too many ports: got %d, max %d", len(cfg.Ports), maxPortScanPorts)
	}
	ports, err := normalizePorts(cfg.Ports)
	if err != nil {
		return cfg, err
	}
	if len(ports) == 0 {
		return cfg, fmt.Errorf("at least one port is required")
	}
	cfg.Ports = ports

	if cfg.Timeout < 0 {
		return cfg, fmt.Errorf("timeout must be non-negative")
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = defaultPortScanTimeoutMS
	}
	if cfg.Timeout > maxPortScanTimeoutMS {
		return cfg, fmt.Errorf("timeout exceeds hard limit: got %d, max %d", cfg.Timeout, maxPortScanTimeoutMS)
	}

	if cfg.Concurrency < 0 {
		return cfg, fmt.Errorf("concurrency must be non-negative")
	}
	if cfg.Concurrency == 0 {
		cfg.Concurrency = defaultPortScanConcurrency
	}
	if cfg.Concurrency > maxPortScanConcurrency {
		return cfg, fmt.Errorf("concurrency exceeds hard limit: got %d, max %d", cfg.Concurrency, maxPortScanConcurrency)
	}

	return cfg, nil
}

func recommendedSchemesForPort(port int) []string {
	if def, ok := portCatalog[port]; ok {
		return append([]string(nil), def.schemes...)
	}
	return []string{"http", "https"}
}

func recommendedURLHost(host string) string {
	if strings.HasPrefix(host, "[") {
		return host
	}
	if strings.Contains(host, ":") && net.ParseIP(host) != nil {
		return "[" + host + "]"
	}
	return host
}

func recommendedURLsForPort(target string, port int) []string {
	schemes := recommendedSchemesForPort(port)
	if len(schemes) == 0 {
		return nil
	}

	host := recommendedURLHost(target)
	urls := make([]string, 0, len(schemes))
	for _, scheme := range schemes {
		urls = append(urls, fmt.Sprintf("%s://%s:%d", scheme, host, port))
	}
	return urls
}

func recommendedTargetsForOpenPorts(target string, ports []PortInfo) []string {
	targets := make([]string, 0, len(ports))
	seen := make(map[string]struct{}, len(ports))
	for _, port := range ports {
		for _, url := range port.RecommendedURLs {
			if _, ok := seen[url]; ok {
				continue
			}
			seen[url] = struct{}{}
			targets = append(targets, url)
			if len(targets) >= maxScanTargets {
				return targets
			}
		}
		if len(port.RecommendedURLs) == 0 {
			for _, url := range recommendedURLsForPort(target, port.Port) {
				if _, ok := seen[url]; ok {
					continue
				}
				seen[url] = struct{}{}
				targets = append(targets, url)
				if len(targets) >= maxScanTargets {
					return targets
				}
			}
		}
	}
	return targets
}

// ScanPorts performs port scanning.
func ScanPorts(ctx context.Context, cfg PortScanConfig, onFound func(PortInfo)) (*PortScanResult, error) {
	normalizedCfg, err := normalizePortScanConfig(cfg)
	if err != nil {
		return nil, err
	}
	cfg = normalizedCfg

	result := &PortScanResult{
		TaskID:    cfg.TaskID,
		Target:    cfg.Target,
		Profile:   cfg.Profile,
		StartedAt: time.Now().UnixMilli(),
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, cfg.Concurrency)

scanLoop:
	for _, port := range cfg.Ports {
		select {
		case <-ctx.Done():
			break scanLoop
		case semaphore <- struct{}{}:
		}

		wg.Add(1)

		go func(p int) {
			defer wg.Done()
			defer func() { <-semaphore }()

			if !isPortOpen(ctx, cfg.Target, p, time.Duration(cfg.Timeout)*time.Millisecond) {
				return
			}
			select {
			case <-ctx.Done():
				return
			default:
			}

			info := PortInfo{
				TaskID:          cfg.TaskID,
				Port:            p,
				Protocol:        "tcp",
				Service:         getServiceName(p),
				Status:          "open",
				RecommendedURLs: recommendedURLsForPort(cfg.Target, p),
			}

			mu.Lock()
			result.OpenPorts = append(result.OpenPorts, info)
			mu.Unlock()

			if onFound != nil {
				onFound(info)
			}

			logger.Debug("port open", "target", cfg.Target, "port", p, "service", info.Service)
		}(port)
	}

	wg.Wait()
	result.FinishedAt = time.Now().UnixMilli()

	// Sort by port number
	sort.Slice(result.OpenPorts, func(i, j int) bool {
		return result.OpenPorts[i].Port < result.OpenPorts[j].Port
	})
	result.RecommendedTargets = recommendedTargetsForOpenPorts(cfg.Target, result.OpenPorts)

	return result, nil
}

// isPortOpen checks if a port is open.
func isPortOpen(ctx context.Context, host string, port int, timeout time.Duration) bool {
	address := fmt.Sprintf("%s:%d", host, port)

	dialer := net.Dialer{Timeout: timeout}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}
