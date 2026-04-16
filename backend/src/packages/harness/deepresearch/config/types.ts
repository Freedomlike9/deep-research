export interface ModelConfig {
  name: string;
  model: string;
  displayName?: string;
  description?: string;
  apiKey?: string;
  temperature?: number;
  topP?: number;
  supportsThinking?: boolean;
  supportsVision?: boolean;
}

export interface ToolConfig {
  name: string;
  description: string;
  group?: string;
}

export interface ResearchConfig {
  searchProvider: "tavily";
  tavilyApiKey?: string;
  searchTopK: number;
  searchConcurrency: number;
  fetchMaxPages: number;
  maxIterations: number;
  requestTimeoutMs: number;
  outputLanguage: string;
}

export interface SandboxConfig {
  enabled: boolean;
  workspaceRoot: string;
}

export interface AppConfig {
  logLevel: "debug" | "info" | "warn" | "error";
  models: ModelConfig[];
  tools: ToolConfig[];
  research: ResearchConfig;
  sandbox: SandboxConfig;
  outputDir: string;
}
