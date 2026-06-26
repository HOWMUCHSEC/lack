export namespace apitest {
	
	export class Request {
	    base_url: string;
	    request_headers: string;
	    request_body: string;
	    method: string;
	    timeout_ms: number;
	
	    static createFrom(source: any = {}) {
	        return new Request(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.base_url = source["base_url"];
	        this.request_headers = source["request_headers"];
	        this.request_body = source["request_body"];
	        this.method = source["method"];
	        this.timeout_ms = source["timeout_ms"];
	    }
	}
	export class Response {
	    success: boolean;
	    status_code: number;
	    response_body: string;
	    response_time: number;
	    error: string;
	    headers: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new Response(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.status_code = source["status_code"];
	        this.response_body = source["response_body"];
	        this.response_time = source["response_time"];
	        this.error = source["error"];
	        this.headers = source["headers"];
	    }
	}

}

export namespace cloudscan {
	
	export class EngineStatus {
	    available: boolean;
	    engine: string;
	    repository: string;
	    path?: string;
	    error?: string;
	    installHint?: string;
	    candidatePaths?: string[];
	
	    static createFrom(source: any = {}) {
	        return new EngineStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.engine = source["engine"];
	        this.repository = source["repository"];
	        this.path = source["path"];
	        this.error = source["error"];
	        this.installHint = source["installHint"];
	        this.candidatePaths = source["candidatePaths"];
	    }
	}
	export class Finding {
	    id: string;
	    type: string;
	    severity: string;
	    title: string;
	    description?: string;
	    message?: string;
	    resource?: string;
	    provider?: string;
	    service?: string;
	    filePath?: string;
	    startLine?: number;
	    endLine?: number;
	    resolution?: string;
	    primaryUrl?: string;
	    references?: string[];
	
	    static createFrom(source: any = {}) {
	        return new Finding(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.severity = source["severity"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.message = source["message"];
	        this.resource = source["resource"];
	        this.provider = source["provider"];
	        this.service = source["service"];
	        this.filePath = source["filePath"];
	        this.startLine = source["startLine"];
	        this.endLine = source["endLine"];
	        this.resolution = source["resolution"];
	        this.primaryUrl = source["primaryUrl"];
	        this.references = source["references"];
	    }
	}
	export class ScanMetrics {
	    compliance: number;
	    iamRisks: number;
	    publicAssets: number;
	    secrets: number;
	    misconfigs: number;
	    filesScanned: number;
	    totalFindings: number;
	    passedChecks: number;
	    failedChecks: number;
	    exceptionChecks: number;
	
	    static createFrom(source: any = {}) {
	        return new ScanMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.compliance = source["compliance"];
	        this.iamRisks = source["iamRisks"];
	        this.publicAssets = source["publicAssets"];
	        this.secrets = source["secrets"];
	        this.misconfigs = source["misconfigs"];
	        this.filesScanned = source["filesScanned"];
	        this.totalFindings = source["totalFindings"];
	        this.passedChecks = source["passedChecks"];
	        this.failedChecks = source["failedChecks"];
	        this.exceptionChecks = source["exceptionChecks"];
	    }
	}
	export class ScanRequest {
	    sourceType: string;
	    target: string;
	    content?: string;
	
	    static createFrom(source: any = {}) {
	        return new ScanRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourceType = source["sourceType"];
	        this.target = source["target"];
	        this.content = source["content"];
	    }
	}
	export class SeverityCounts {
	    critical: number;
	    high: number;
	    medium: number;
	    low: number;
	    unknown: number;
	
	    static createFrom(source: any = {}) {
	        return new SeverityCounts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.critical = source["critical"];
	        this.high = source["high"];
	        this.medium = source["medium"];
	        this.low = source["low"];
	        this.unknown = source["unknown"];
	    }
	}
	export class ScanResult {
	    id: string;
	    target: string;
	    sourceType: string;
	    engine: string;
	    scannedAt: number;
	    score: number;
	    summary: string;
	    severityCounts: SeverityCounts;
	    metrics: ScanMetrics;
	    findings: Finding[];
	
	    static createFrom(source: any = {}) {
	        return new ScanResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.target = source["target"];
	        this.sourceType = source["sourceType"];
	        this.engine = source["engine"];
	        this.scannedAt = source["scannedAt"];
	        this.score = source["score"];
	        this.summary = source["summary"];
	        this.severityCounts = this.convertValues(source["severityCounts"], SeverityCounts);
	        this.metrics = this.convertValues(source["metrics"], ScanMetrics);
	        this.findings = this.convertValues(source["findings"], Finding);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace evaluator {
	
	export class HfDatasetRef {
	    repoId: string;
	    config: string;
	    split: string;
	
	    static createFrom(source: any = {}) {
	        return new HfDatasetRef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.repoId = source["repoId"];
	        this.config = source["config"];
	        this.split = source["split"];
	    }
	}
	export class DatasetConfig {
	    localSampleSetIds?: string[];
	    cloudSampleSetIds?: string[];
	    hfDatasets?: HfDatasetRef[];
	    fieldMappings?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new DatasetConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.localSampleSetIds = source["localSampleSetIds"];
	        this.cloudSampleSetIds = source["cloudSampleSetIds"];
	        this.hfDatasets = this.convertValues(source["hfDatasets"], HfDatasetRef);
	        this.fieldMappings = source["fieldMappings"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EvalModelConfig {
	    provider: string;
	    baseUrl: string;
	    apiKey: string;
	    model: string;
	
	    static createFrom(source: any = {}) {
	        return new EvalModelConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.baseUrl = source["baseUrl"];
	        this.apiKey = source["apiKey"];
	        this.model = source["model"];
	    }
	}
	export class TargetModelConfig {
	    baseUrl: string;
	    apiKey: string;
	    model: string;
	
	    static createFrom(source: any = {}) {
	        return new TargetModelConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.baseUrl = source["baseUrl"];
	        this.apiKey = source["apiKey"];
	        this.model = source["model"];
	    }
	}
	export class EvalProject {
	    id: string;
	    name: string;
	    description?: string;
	    targetModel: TargetModelConfig;
	    evalModel: EvalModelConfig;
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new EvalProject(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.targetModel = this.convertValues(source["targetModel"], TargetModelConfig);
	        this.evalModel = this.convertValues(source["evalModel"], EvalModelConfig);
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EvalResult {
	    score: number;
	    label: string;
	    reasoning: string;
	    raw: string;
	    refused?: boolean;
	    safe?: boolean;
	    jailbroken?: boolean;
	    attackSucceeded?: boolean;
	    harmless?: boolean;
	    helpful?: boolean;
	    honest?: boolean;
	    ethical?: boolean;
	    truthful?: boolean;
	    informative?: boolean;
	    isCorrect?: boolean;
	    isTruthful?: boolean;
	    safetyScore?: number;
	    overallScore?: number;
	    parseError?: string;
	
	    static createFrom(source: any = {}) {
	        return new EvalResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.score = source["score"];
	        this.label = source["label"];
	        this.reasoning = source["reasoning"];
	        this.raw = source["raw"];
	        this.refused = source["refused"];
	        this.safe = source["safe"];
	        this.jailbroken = source["jailbroken"];
	        this.attackSucceeded = source["attackSucceeded"];
	        this.harmless = source["harmless"];
	        this.helpful = source["helpful"];
	        this.honest = source["honest"];
	        this.ethical = source["ethical"];
	        this.truthful = source["truthful"];
	        this.informative = source["informative"];
	        this.isCorrect = source["isCorrect"];
	        this.isTruthful = source["isTruthful"];
	        this.safetyScore = source["safetyScore"];
	        this.overallScore = source["overallScore"];
	        this.parseError = source["parseError"];
	    }
	}
	export class EvalRunResult {
	    runId: string;
	    taskId: string;
	    startedAt: number;
	    finishedAt: number;
	    total: number;
	    completed: number;
	    passed: number;
	    failed: number;
	    errors: number;
	    aborted: boolean;
	    error?: string;
	    avgScore: number;
	    passRate: number;
	    refuseRate?: number;
	
	    static createFrom(source: any = {}) {
	        return new EvalRunResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.runId = source["runId"];
	        this.taskId = source["taskId"];
	        this.startedAt = source["startedAt"];
	        this.finishedAt = source["finishedAt"];
	        this.total = source["total"];
	        this.completed = source["completed"];
	        this.passed = source["passed"];
	        this.failed = source["failed"];
	        this.errors = source["errors"];
	        this.aborted = source["aborted"];
	        this.error = source["error"];
	        this.avgScore = source["avgScore"];
	        this.passRate = source["passRate"];
	        this.refuseRate = source["refuseRate"];
	    }
	}
	export class EvalTask {
	    id: string;
	    projectId: string;
	    name: string;
	    evaluatorType: string;
	    templateId?: string;
	    datasetConfig: DatasetConfig;
	    concurrency: number;
	    maxRetries: number;
	    timeoutMs: number;
	    sampleCount: number;
	    sampleSeed: number;
	    status: string;
	    totalItems: number;
	    preparedAt?: number;
	    errorMessage?: string;
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new EvalTask(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.projectId = source["projectId"];
	        this.name = source["name"];
	        this.evaluatorType = source["evaluatorType"];
	        this.templateId = source["templateId"];
	        this.datasetConfig = this.convertValues(source["datasetConfig"], DatasetConfig);
	        this.concurrency = source["concurrency"];
	        this.maxRetries = source["maxRetries"];
	        this.timeoutMs = source["timeoutMs"];
	        this.sampleCount = source["sampleCount"];
	        this.sampleSeed = source["sampleSeed"];
	        this.status = source["status"];
	        this.totalItems = source["totalItems"];
	        this.preparedAt = source["preparedAt"];
	        this.errorMessage = source["errorMessage"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EvaluatorInfo {
	    evaluatorType: string;
	    name: string;
	    nameZh: string;
	    description: string;
	    descriptionZh: string;
	    version: string;
	    supportedDatasets: string[];
	    minPlan: string;
	
	    static createFrom(source: any = {}) {
	        return new EvaluatorInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.evaluatorType = source["evaluatorType"];
	        this.name = source["name"];
	        this.nameZh = source["nameZh"];
	        this.description = source["description"];
	        this.descriptionZh = source["descriptionZh"];
	        this.version = source["version"];
	        this.supportedDatasets = source["supportedDatasets"];
	        this.minPlan = source["minPlan"];
	    }
	}
	export class EvaluatorTemplate {
	    id: string;
	    evaluator_type: string;
	    name: string;
	    name_zh: string;
	    description: string;
	    description_zh: string;
	    version: string;
	    supported_datasets: string[];
	    field_mappings: Record<string, any>;
	    target_prompt_template: string;
	    eval_prompt_template: string;
	    result_schema: Record<string, string>;
	    status: string;
	    min_plan: string;
	    created_at: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new EvaluatorTemplate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.evaluator_type = source["evaluator_type"];
	        this.name = source["name"];
	        this.name_zh = source["name_zh"];
	        this.description = source["description"];
	        this.description_zh = source["description_zh"];
	        this.version = source["version"];
	        this.supported_datasets = source["supported_datasets"];
	        this.field_mappings = source["field_mappings"];
	        this.target_prompt_template = source["target_prompt_template"];
	        this.eval_prompt_template = source["eval_prompt_template"];
	        this.result_schema = source["result_schema"];
	        this.status = source["status"];
	        this.min_plan = source["min_plan"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	
	export class ListResult {
	    items: any;
	    total: number;
	    hasMore: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ListResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = source["items"];
	        this.total = source["total"];
	        this.hasMore = source["hasMore"];
	    }
	}
	
	export class TestItem {
	    id: string;
	    taskId: string;
	    index: number;
	    sourceType: string;
	    sourceId: string;
	    originalData: Record<string, any>;
	    targetPrompt: string;
	    category?: string;
	    riskArea?: string;
	    expectedBehavior?: string;
	    status: string;
	    targetResponse?: string;
	    evalPrompt?: string;
	    evalResult?: EvalResult;
	    attempts: number;
	    lastError?: string;
	    durationMs?: number;
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new TestItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.taskId = source["taskId"];
	        this.index = source["index"];
	        this.sourceType = source["sourceType"];
	        this.sourceId = source["sourceId"];
	        this.originalData = source["originalData"];
	        this.targetPrompt = source["targetPrompt"];
	        this.category = source["category"];
	        this.riskArea = source["riskArea"];
	        this.expectedBehavior = source["expectedBehavior"];
	        this.status = source["status"];
	        this.targetResponse = source["targetResponse"];
	        this.evalPrompt = source["evalPrompt"];
	        this.evalResult = this.convertValues(source["evalResult"], EvalResult);
	        this.attempts = source["attempts"];
	        this.lastError = source["lastError"];
	        this.durationMs = source["durationMs"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace main {
	
	export class DashboardStats {
	    totalProjects: number;
	    totalTasks: number;
	    runningTasks: number;
	    completedToday: number;
	    highRiskCount: number;
	
	    static createFrom(source: any = {}) {
	        return new DashboardStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalProjects = source["totalProjects"];
	        this.totalTasks = source["totalTasks"];
	        this.runningTasks = source["runningTasks"];
	        this.completedToday = source["completedToday"];
	        this.highRiskCount = source["highRiskCount"];
	    }
	}
	export class DatasetFieldInfo {
	    name: string;
	    sampleValue: string;
	    inferredType: string;
	
	    static createFrom(source: any = {}) {
	        return new DatasetFieldInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.sampleValue = source["sampleValue"];
	        this.inferredType = source["inferredType"];
	    }
	}
	export class ReportResearchInsights {
	    paperCount: number;
	    findings: string[];
	
	    static createFrom(source: any = {}) {
	        return new ReportResearchInsights(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.paperCount = source["paperCount"];
	        this.findings = source["findings"];
	    }
	}
	export class ReportQuickStats {
	    passCount: number;
	    failCount: number;
	    skipCount: number;
	    passRate: number;
	    peakMemory: string;
	    avgGPU: string;
	    throughput: string;
	    errorRate: string;
	
	    static createFrom(source: any = {}) {
	        return new ReportQuickStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.passCount = source["passCount"];
	        this.failCount = source["failCount"];
	        this.skipCount = source["skipCount"];
	        this.passRate = source["passRate"];
	        this.peakMemory = source["peakMemory"];
	        this.avgGPU = source["avgGPU"];
	        this.throughput = source["throughput"];
	        this.errorRate = source["errorRate"];
	    }
	}
	export class ReportValidationResults {
	    input: string;
	    output: string;
	    schema: string;
	
	    static createFrom(source: any = {}) {
	        return new ReportValidationResults(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.input = source["input"];
	        this.output = source["output"];
	        this.schema = source["schema"];
	    }
	}
	export class ReportTestCaseResult {
	    id: string;
	    description: string;
	    status: string;
	    time: string;
	
	    static createFrom(source: any = {}) {
	        return new ReportTestCaseResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.description = source["description"];
	        this.status = source["status"];
	        this.time = source["time"];
	    }
	}
	export class ReportSampleStats {
	    total: number;
	    covered: number;
	    rate: number;
	
	    static createFrom(source: any = {}) {
	        return new ReportSampleStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.covered = source["covered"];
	        this.rate = source["rate"];
	    }
	}
	export class ReportChartData {
	    name: string;
	    Accuracy: number;
	    Precision: number;
	    Recall: number;
	
	    static createFrom(source: any = {}) {
	        return new ReportChartData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.Accuracy = source["Accuracy"];
	        this.Precision = source["Precision"];
	        this.Recall = source["Recall"];
	    }
	}
	export class ReportTaskMetric {
	    name: string;
	    total: number;
	    completed: number;
	    failed: number;
	    successRate: number;
	
	    static createFrom(source: any = {}) {
	        return new ReportTaskMetric(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.total = source["total"];
	        this.completed = source["completed"];
	        this.failed = source["failed"];
	        this.successRate = source["successRate"];
	    }
	}
	export class SecurityItem {
	    status: string;
	    findings: number;
	    vulnerabilities: number;
	    critical: number;
	    riskLevel: string;
	    threats: number;
	
	    static createFrom(source: any = {}) {
	        return new SecurityItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.findings = source["findings"];
	        this.vulnerabilities = source["vulnerabilities"];
	        this.critical = source["critical"];
	        this.riskLevel = source["riskLevel"];
	        this.threats = source["threats"];
	    }
	}
	export class ReportSecurityStats {
	    mcp: SecurityItem;
	    infra: SecurityItem;
	    cloud: SecurityItem;
	
	    static createFrom(source: any = {}) {
	        return new ReportSecurityStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mcp = this.convertValues(source["mcp"], SecurityItem);
	        this.infra = this.convertValues(source["infra"], SecurityItem);
	        this.cloud = this.convertValues(source["cloud"], SecurityItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EvaluationReportData {
	    score: number;
	    totalTests: number;
	    passRate: string;
	    avgTime: string;
	    security: ReportSecurityStats;
	    tasks: ReportTaskMetric[];
	    performance: ReportChartData[];
	    sampleCover: ReportSampleStats;
	    testCases: ReportTestCaseResult[];
	    validation: ReportValidationResults;
	    quickStats: ReportQuickStats;
	    research: ReportResearchInsights;
	    generatedAt: string;
	    projectInfo: string;
	
	    static createFrom(source: any = {}) {
	        return new EvaluationReportData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.score = source["score"];
	        this.totalTests = source["totalTests"];
	        this.passRate = source["passRate"];
	        this.avgTime = source["avgTime"];
	        this.security = this.convertValues(source["security"], ReportSecurityStats);
	        this.tasks = this.convertValues(source["tasks"], ReportTaskMetric);
	        this.performance = this.convertValues(source["performance"], ReportChartData);
	        this.sampleCover = this.convertValues(source["sampleCover"], ReportSampleStats);
	        this.testCases = this.convertValues(source["testCases"], ReportTestCaseResult);
	        this.validation = this.convertValues(source["validation"], ReportValidationResults);
	        this.quickStats = this.convertValues(source["quickStats"], ReportQuickStats);
	        this.research = this.convertValues(source["research"], ReportResearchInsights);
	        this.generatedAt = source["generatedAt"];
	        this.projectInfo = source["projectInfo"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class KV {
	    key: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new KV(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	    }
	}
	export class ListResult {
	    items: any;
	    total: number;
	    hasMore: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ListResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = source["items"];
	        this.total = source["total"];
	        this.hasMore = source["hasMore"];
	    }
	}
	export class ManualScanStepEvaluationRequest {
	    taskId: string;
	    judgeModelId: string;
	    evaluatorType: string;
	    templateId: string;
	    requestField?: string;
	    responseField?: string;
	    steps: scanner.StepResult[];
	
	    static createFrom(source: any = {}) {
	        return new ManualScanStepEvaluationRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.taskId = source["taskId"];
	        this.judgeModelId = source["judgeModelId"];
	        this.evaluatorType = source["evaluatorType"];
	        this.templateId = source["templateId"];
	        this.requestField = source["requestField"];
	        this.responseField = source["responseField"];
	        this.steps = this.convertValues(source["steps"], scanner.StepResult);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ManualScanStepEvaluationResult {
	    index: number;
	    sampleId: string;
	    prompt: string;
	    response: string;
	    score: number;
	    label: string;
	    reasoning: string;
	    status: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ManualScanStepEvaluationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.sampleId = source["sampleId"];
	        this.prompt = source["prompt"];
	        this.response = source["response"];
	        this.score = source["score"];
	        this.label = source["label"];
	        this.reasoning = source["reasoning"];
	        this.status = source["status"];
	        this.error = source["error"];
	    }
	}
	export class RecentTaskItem {
	    id: string;
	    name: string;
	    type: string;
	    status: string;
	    progress: number;
	    total: number;
	    completed: number;
	    passRate: number;
	    executedAt: number;
	    projectName: string;
	
	    static createFrom(source: any = {}) {
	        return new RecentTaskItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.status = source["status"];
	        this.progress = source["progress"];
	        this.total = source["total"];
	        this.completed = source["completed"];
	        this.passRate = source["passRate"];
	        this.executedAt = source["executedAt"];
	        this.projectName = source["projectName"];
	    }
	}
	export class Report {
	    id: string;
	    projectId: string;
	    projectName: string;
	    status: string;
	    createdAt: number;
	    data?: EvaluationReportData;
	
	    static createFrom(source: any = {}) {
	        return new Report(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.projectId = source["projectId"];
	        this.projectName = source["projectName"];
	        this.status = source["status"];
	        this.createdAt = source["createdAt"];
	        this.data = this.convertValues(source["data"], EvaluationReportData);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ReportListItem {
	    id: string;
	    projectId: string;
	    projectName: string;
	    status: string;
	    createdAt: number;
	    score: number;
	    totalTests: number;
	
	    static createFrom(source: any = {}) {
	        return new ReportListItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.projectId = source["projectId"];
	        this.projectName = source["projectName"];
	        this.status = source["status"];
	        this.createdAt = source["createdAt"];
	        this.score = source["score"];
	        this.totalTests = source["totalTests"];
	    }
	}
	
	
	
	
	
	
	
	export class RiskDistItem {
	    high: number;
	    medium: number;
	    low: number;
	
	    static createFrom(source: any = {}) {
	        return new RiskDistItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.high = source["high"];
	        this.medium = source["medium"];
	        this.low = source["low"];
	    }
	}
	
	export class TaskDatasetConfig {
	    testCaseIds: string[];
	    communityIds: string[];
	    hfDatasetIds: string[];
	    fieldMappings: Record<string, string>;
	    localSampleSetIds?: string[];
	    cloudSampleSetIds?: string[];
	
	    static createFrom(source: any = {}) {
	        return new TaskDatasetConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.testCaseIds = source["testCaseIds"];
	        this.communityIds = source["communityIds"];
	        this.hfDatasetIds = source["hfDatasetIds"];
	        this.fieldMappings = source["fieldMappings"];
	        this.localSampleSetIds = source["localSampleSetIds"];
	        this.cloudSampleSetIds = source["cloudSampleSetIds"];
	    }
	}
	export class TaskStats {
	    taskID: string;
	    totalRuns: number;
	    latestRunID?: string;
	    totalSamples: number;
	    totalOk: number;
	    totalFailed: number;
	    isRunning: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TaskStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.taskID = source["taskID"];
	        this.totalRuns = source["totalRuns"];
	        this.latestRunID = source["latestRunID"];
	        this.totalSamples = source["totalSamples"];
	        this.totalOk = source["totalOk"];
	        this.totalFailed = source["totalFailed"];
	        this.isRunning = source["isRunning"];
	    }
	}
	export class TaskTrendItem {
	    date: string;
	    tasks: number;
	
	    static createFrom(source: any = {}) {
	        return new TaskTrendItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.tasks = source["tasks"];
	    }
	}
	export class TestCase {
	    id: string;
	    category: string;
	    title: string;
	    content: string;
	    expectedResponse?: string;
	    severity: string;
	    status: string;
	    tags?: string[];
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new TestCase(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.category = source["category"];
	        this.title = source["title"];
	        this.content = source["content"];
	        this.expectedResponse = source["expectedResponse"];
	        this.severity = source["severity"];
	        this.status = source["status"];
	        this.tags = source["tags"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class UnifiedSample {
	    id: string;
	    source: string;
	    content: string;
	    category?: string;
	    severity?: string;
	    expectedOutput?: string;
	
	    static createFrom(source: any = {}) {
	        return new UnifiedSample(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.source = source["source"];
	        this.content = source["content"];
	        this.category = source["category"];
	        this.severity = source["severity"];
	        this.expectedOutput = source["expectedOutput"];
	    }
	}
	export class UserVariable {
	    id: string;
	    name: string;
	    value: string;
	    enabled: boolean;
	    description?: string;
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new UserVariable(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.value = source["value"];
	        this.enabled = source["enabled"];
	        this.description = source["description"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}

}

export namespace mcpserver {
	
	export class LocalServerStatus {
	    running: boolean;
	    endpoint: string;
	    authToken?: string;
	    port: number;
	    startedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new LocalServerStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.endpoint = source["endpoint"];
	        this.authToken = source["authToken"];
	        this.port = source["port"];
	        this.startedAt = source["startedAt"];
	    }
	}
	export class MCPIssue {
	    severity: string;
	    rule: string;
	    file: string;
	    line: number;
	    title: string;
	    evidence: string;
	    remediation: string;
	
	    static createFrom(source: any = {}) {
	        return new MCPIssue(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.severity = source["severity"];
	        this.rule = source["rule"];
	        this.file = source["file"];
	        this.line = source["line"];
	        this.title = source["title"];
	        this.evidence = source["evidence"];
	        this.remediation = source["remediation"];
	    }
	}
	export class MCPReportMeta {
	    id: string;
	    createdAt: number;
	    agent: string;
	    total: number;
	    high: number;
	    medium: number;
	    low: number;
	
	    static createFrom(source: any = {}) {
	        return new MCPReportMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.createdAt = source["createdAt"];
	        this.agent = source["agent"];
	        this.total = source["total"];
	        this.high = source["high"];
	        this.medium = source["medium"];
	        this.low = source["low"];
	    }
	}
	export class MCPReport {
	    meta: MCPReportMeta;
	    issues: MCPIssue[];
	
	    static createFrom(source: any = {}) {
	        return new MCPReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.meta = this.convertValues(source["meta"], MCPReportMeta);
	        this.issues = this.convertValues(source["issues"], MCPIssue);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ResultData {
	    ruleId: string;
	    ruleName: string;
	    filePath: string;
	    line: number;
	    column: number;
	    matchedText: string;
	    context: string;
	    language: string;
	    severity: string;
	    description: string;
	    timestamp: string;
	
	    static createFrom(source: any = {}) {
	        return new ResultData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ruleId = source["ruleId"];
	        this.ruleName = source["ruleName"];
	        this.filePath = source["filePath"];
	        this.line = source["line"];
	        this.column = source["column"];
	        this.matchedText = source["matchedText"];
	        this.context = source["context"];
	        this.language = source["language"];
	        this.severity = source["severity"];
	        this.description = source["description"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class ScanSession {
	    id: string;
	    scannerId: string;
	    status: string;
	    targets: string[];
	    totalFiles: number;
	    scannedFiles: number;
	    totalMatches: number;
	    critical: number;
	    high: number;
	    medium: number;
	    low: number;
	    startedAt: number;
	    completedAt: number;
	    results: ResultData[];
	
	    static createFrom(source: any = {}) {
	        return new ScanSession(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.scannerId = source["scannerId"];
	        this.status = source["status"];
	        this.targets = source["targets"];
	        this.totalFiles = source["totalFiles"];
	        this.scannedFiles = source["scannedFiles"];
	        this.totalMatches = source["totalMatches"];
	        this.critical = source["critical"];
	        this.high = source["high"];
	        this.medium = source["medium"];
	        this.low = source["low"];
	        this.startedAt = source["startedAt"];
	        this.completedAt = source["completedAt"];
	        this.results = this.convertValues(source["results"], ResultData);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace nucleiscan {
	
	export class FindingEvent {
	    runID: string;
	    taskID: string;
	    templateID: string;
	    templateName: string;
	    severity: string;
	    host: string;
	    matched: string;
	    extractedResults?: string[];
	    timestamp: number;
	    metadata?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new FindingEvent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.runID = source["runID"];
	        this.taskID = source["taskID"];
	        this.templateID = source["templateID"];
	        this.templateName = source["templateName"];
	        this.severity = source["severity"];
	        this.host = source["host"];
	        this.matched = source["matched"];
	        this.extractedResults = source["extractedResults"];
	        this.timestamp = source["timestamp"];
	        this.metadata = source["metadata"];
	    }
	}
	export class PortInfo {
	    taskID: string;
	    port: number;
	    protocol: string;
	    service: string;
	    status: string;
	    recommendedURLs?: string[];
	
	    static createFrom(source: any = {}) {
	        return new PortInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.taskID = source["taskID"];
	        this.port = source["port"];
	        this.protocol = source["protocol"];
	        this.service = source["service"];
	        this.status = source["status"];
	        this.recommendedURLs = source["recommendedURLs"];
	    }
	}
	export class PortScanConfig {
	    taskID: string;
	    target: string;
	    profile: string;
	    ports: number[];
	    timeout: number;
	    concurrency: number;
	
	    static createFrom(source: any = {}) {
	        return new PortScanConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.taskID = source["taskID"];
	        this.target = source["target"];
	        this.profile = source["profile"];
	        this.ports = source["ports"];
	        this.timeout = source["timeout"];
	        this.concurrency = source["concurrency"];
	    }
	}
	export class PortScanResult {
	    taskID: string;
	    target: string;
	    profile: string;
	    openPorts: PortInfo[];
	    recommendedTargets: string[];
	    startedAt: number;
	    finishedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new PortScanResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.taskID = source["taskID"];
	        this.target = source["target"];
	        this.profile = source["profile"];
	        this.openPorts = this.convertValues(source["openPorts"], PortInfo);
	        this.recommendedTargets = source["recommendedTargets"];
	        this.startedAt = source["startedAt"];
	        this.finishedAt = source["finishedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ScanConfig {
	    taskID: string;
	    targets: string[];
	    templates: string[];
	    concurrency: number;
	    rateLimit: number;
	    timeout: number;
	
	    static createFrom(source: any = {}) {
	        return new ScanConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.taskID = source["taskID"];
	        this.targets = source["targets"];
	        this.templates = source["templates"];
	        this.concurrency = source["concurrency"];
	        this.rateLimit = source["rateLimit"];
	        this.timeout = source["timeout"];
	    }
	}
	export class ScanResult {
	    runID: string;
	    taskID: string;
	    startedAt: number;
	    finishedAt: number;
	    total: number;
	    findings: number;
	    errors: number;
	    aborted: boolean;
	    results?: FindingEvent[];
	
	    static createFrom(source: any = {}) {
	        return new ScanResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.runID = source["runID"];
	        this.taskID = source["taskID"];
	        this.startedAt = source["startedAt"];
	        this.finishedAt = source["finishedAt"];
	        this.total = source["total"];
	        this.findings = source["findings"];
	        this.errors = source["errors"];
	        this.aborted = source["aborted"];
	        this.results = this.convertValues(source["results"], FindingEvent);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TemplateInfo {
	    id: string;
	    name: string;
	    author: string;
	    severity: string;
	    description: string;
	    tags: string;
	    filePath: string;
	
	    static createFrom(source: any = {}) {
	        return new TemplateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.author = source["author"];
	        this.severity = source["severity"];
	        this.description = source["description"];
	        this.tags = source["tags"];
	        this.filePath = source["filePath"];
	    }
	}

}

export namespace samples {
	
	export class CommunityPrompt {
	    id: number;
	    labelLv1: string;
	    labelLv2: string;
	    promptText: string;
	    expectedOutput?: string;
	    promptHash: string;
	    downloadedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new CommunityPrompt(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.labelLv1 = source["labelLv1"];
	        this.labelLv2 = source["labelLv2"];
	        this.promptText = source["promptText"];
	        this.expectedOutput = source["expectedOutput"];
	        this.promptHash = source["promptHash"];
	        this.downloadedAt = source["downloadedAt"];
	    }
	}
	export class Variable {
	    name: string;
	    values: string[];
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Variable(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.values = source["values"];
	        this.enabled = source["enabled"];
	    }
	}
	export class GenerateRequest {
	    testCaseId: string;
	    testCaseTitle: string;
	    content: string;
	    category: string;
	    severity: string;
	    tags?: string[];
	    variables: Variable[];
	    setName?: string;
	    setDescription?: string;
	
	    static createFrom(source: any = {}) {
	        return new GenerateRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.testCaseId = source["testCaseId"];
	        this.testCaseTitle = source["testCaseTitle"];
	        this.content = source["content"];
	        this.category = source["category"];
	        this.severity = source["severity"];
	        this.tags = source["tags"];
	        this.variables = this.convertValues(source["variables"], Variable);
	        this.setName = source["setName"];
	        this.setDescription = source["setDescription"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GenerateResult {
	    success: boolean;
	    setId?: string;
	    sampleCount: number;
	    sampleIds?: string[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new GenerateResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.setId = source["setId"];
	        this.sampleCount = source["sampleCount"];
	        this.sampleIds = source["sampleIds"];
	        this.error = source["error"];
	    }
	}
	export class HfDataRow {
	    id: number;
	    hfRepoId: string;
	    config: string;
	    split: string;
	    sourceIndex: number;
	    data: Record<string, any>;
	    checksum?: string;
	    importedAt: string;
	    updatedAt: string;
	    status: string;
	    extraMetadata?: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new HfDataRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.hfRepoId = source["hfRepoId"];
	        this.config = source["config"];
	        this.split = source["split"];
	        this.sourceIndex = source["sourceIndex"];
	        this.data = source["data"];
	        this.checksum = source["checksum"];
	        this.importedAt = source["importedAt"];
	        this.updatedAt = source["updatedAt"];
	        this.status = source["status"];
	        this.extraMetadata = source["extraMetadata"];
	    }
	}
	export class HfDatasetMeta {
	    hfRepoId: string;
	    config: string;
	    split: string;
	    rowCount: number;
	    downloadedAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new HfDatasetMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hfRepoId = source["hfRepoId"];
	        this.config = source["config"];
	        this.split = source["split"];
	        this.rowCount = source["rowCount"];
	        this.downloadedAt = source["downloadedAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class ListResult {
	    items: any;
	    total: number;
	    hasMore: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ListResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = source["items"];
	        this.total = source["total"];
	        this.hasMore = source["hasMore"];
	    }
	}
	export class Sample {
	    id: string;
	    testCaseId: string;
	    testCaseTitle: string;
	    originalContent: string;
	    generatedContent: string;
	    variables: Record<string, string>;
	    category: string;
	    severity: string;
	    tags?: string[];
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Sample(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.testCaseId = source["testCaseId"];
	        this.testCaseTitle = source["testCaseTitle"];
	        this.originalContent = source["originalContent"];
	        this.generatedContent = source["generatedContent"];
	        this.variables = source["variables"];
	        this.category = source["category"];
	        this.severity = source["severity"];
	        this.tags = source["tags"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class SampleSet {
	    id: string;
	    name: string;
	    description?: string;
	    testCaseIds: string[];
	    sampleCount: number;
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new SampleSet(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.testCaseIds = source["testCaseIds"];
	        this.sampleCount = source["sampleCount"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}

}

export namespace scanner {
	
	export class RequestSpec {
	    baseURL: string;
	    method: string;
	    headersJSON: string;
	    bodyJSON: string;
	    requestField: string;
	    responseField: string;
	
	    static createFrom(source: any = {}) {
	        return new RequestSpec(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.baseURL = source["baseURL"];
	        this.method = source["method"];
	        this.headersJSON = source["headersJSON"];
	        this.bodyJSON = source["bodyJSON"];
	        this.requestField = source["requestField"];
	        this.responseField = source["responseField"];
	    }
	}
	export class RetryPolicy {
	    maxAttempts: number;
	    perAttemptTimeoutMs: number;
	    baseBackoffMs: number;
	    maxBackoffMs: number;
	    jitterPct: number;
	
	    static createFrom(source: any = {}) {
	        return new RetryPolicy(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.maxAttempts = source["maxAttempts"];
	        this.perAttemptTimeoutMs = source["perAttemptTimeoutMs"];
	        this.baseBackoffMs = source["baseBackoffMs"];
	        this.maxBackoffMs = source["maxBackoffMs"];
	        this.jitterPct = source["jitterPct"];
	    }
	}
	export class Sample {
	    id: string;
	    prompt: string;
	    meta?: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new Sample(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.prompt = source["prompt"];
	        this.meta = source["meta"];
	    }
	}
	export class StatusPolicy {
	    expectedSuccess: string[];
	    retryOn: string[];
	    failOn: string[];
	
	    static createFrom(source: any = {}) {
	        return new StatusPolicy(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.expectedSuccess = source["expectedSuccess"];
	        this.retryOn = source["retryOn"];
	        this.failOn = source["failOn"];
	    }
	}
	export class RunConfig {
	    taskID: string;
	    concurrency: number;
	    abortAfterFailures: number;
	    retry: RetryPolicy;
	    status: StatusPolicy;
	    variables: Record<string, string>;
	    request: RequestSpec;
	    samples: Sample[];
	
	    static createFrom(source: any = {}) {
	        return new RunConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.taskID = source["taskID"];
	        this.concurrency = source["concurrency"];
	        this.abortAfterFailures = source["abortAfterFailures"];
	        this.retry = this.convertValues(source["retry"], RetryPolicy);
	        this.status = this.convertValues(source["status"], StatusPolicy);
	        this.variables = source["variables"];
	        this.request = this.convertValues(source["request"], RequestSpec);
	        this.samples = this.convertValues(source["samples"], Sample);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RunResult {
	    runID: string;
	    taskID: string;
	    startedAt: number;
	    finishedAt: number;
	    total: number;
	    ok: number;
	    failed: number;
	    aborted: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RunResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.runID = source["runID"];
	        this.taskID = source["taskID"];
	        this.startedAt = source["startedAt"];
	        this.finishedAt = source["finishedAt"];
	        this.total = source["total"];
	        this.ok = source["ok"];
	        this.failed = source["failed"];
	        this.aborted = source["aborted"];
	    }
	}
	
	
	export class StepResult {
	    runID: string;
	    taskID: string;
	    sampleID: string;
	    attempt: number;
	    statusCode: number;
	    success: boolean;
	    durationMs: number;
	    error: string;
	    headers: Record<string, string>;
	    reqPreview: string;
	    respPreview: string;
	    finalRequest: RequestSpec;
	    responseBody: string;
	
	    static createFrom(source: any = {}) {
	        return new StepResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.runID = source["runID"];
	        this.taskID = source["taskID"];
	        this.sampleID = source["sampleID"];
	        this.attempt = source["attempt"];
	        this.statusCode = source["statusCode"];
	        this.success = source["success"];
	        this.durationMs = source["durationMs"];
	        this.error = source["error"];
	        this.headers = source["headers"];
	        this.reqPreview = source["reqPreview"];
	        this.respPreview = source["respPreview"];
	        this.finalRequest = this.convertValues(source["finalRequest"], RequestSpec);
	        this.responseBody = source["responseBody"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace updater {
	
	export class CheckResult {
	    current_version: string;
	    latest_version: string;
	    has_update: boolean;
	    raw_body: string;
	    last_updated: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new CheckResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.current_version = source["current_version"];
	        this.latest_version = source["latest_version"];
	        this.has_update = source["has_update"];
	        this.raw_body = source["raw_body"];
	        this.last_updated = source["last_updated"];
	        this.error = source["error"];
	    }
	}

}

export namespace yamlscan {
	
	export class Finding {
	    line: number;
	    ruleId: string;
	    matched: string[];
	    context: string;
	    severity: string;
	    category: string;
	    description: string;
	    suggestion: string;
	
	    static createFrom(source: any = {}) {
	        return new Finding(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.line = source["line"];
	        this.ruleId = source["ruleId"];
	        this.matched = source["matched"];
	        this.context = source["context"];
	        this.severity = source["severity"];
	        this.category = source["category"];
	        this.description = source["description"];
	        this.suggestion = source["suggestion"];
	    }
	}
	export class Rule {
	    id: string;
	    severity: string;
	    category: string;
	    description: string;
	    suggestion: string;
	
	    static createFrom(source: any = {}) {
	        return new Rule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.severity = source["severity"];
	        this.category = source["category"];
	        this.description = source["description"];
	        this.suggestion = source["suggestion"];
	    }
	}
	export class ScanHistory {
	    id: string;
	    sourceUrl: string;
	    safe: boolean;
	    criticalCount: number;
	    highCount: number;
	    mediumCount: number;
	    lowCount: number;
	    scannedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ScanHistory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sourceUrl = source["sourceUrl"];
	        this.safe = source["safe"];
	        this.criticalCount = source["criticalCount"];
	        this.highCount = source["highCount"];
	        this.mediumCount = source["mediumCount"];
	        this.lowCount = source["lowCount"];
	        this.scannedAt = source["scannedAt"];
	    }
	}
	export class ScanRequest {
	    content: string;
	    sourceUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new ScanRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.content = source["content"];
	        this.sourceUrl = source["sourceUrl"];
	    }
	}
	export class Summary {
	    totalLines: number;
	    criticalCount: number;
	    highCount: number;
	    mediumCount: number;
	    lowCount: number;
	
	    static createFrom(source: any = {}) {
	        return new Summary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalLines = source["totalLines"];
	        this.criticalCount = source["criticalCount"];
	        this.highCount = source["highCount"];
	        this.mediumCount = source["mediumCount"];
	        this.lowCount = source["lowCount"];
	    }
	}
	export class ScanResult {
	    id: string;
	    valid: boolean;
	    safe: boolean;
	    findings: Finding[];
	    error: string;
	    summary: Summary;
	    scannedAt: string;
	    sourceUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new ScanResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.valid = source["valid"];
	        this.safe = source["safe"];
	        this.findings = this.convertValues(source["findings"], Finding);
	        this.error = source["error"];
	        this.summary = this.convertValues(source["summary"], Summary);
	        this.scannedAt = source["scannedAt"];
	        this.sourceUrl = source["sourceUrl"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

