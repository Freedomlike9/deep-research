import path from "node:path";
import { config as loadDotenv } from "dotenv";
import type { AppConfig } from "./types.ts";
import { backendRoot } from "./paths.ts";

loadDotenv({
  path: path.resolve(backendRoot, "../.env")
});

let cachedConfig: AppConfig | null = null;

const defaultModelName = process.env.LLM_MODEL || "gpt-4o-mini";
const buildDefaultConfig = (): AppConfig => ({
  logLevel: (process.env.LOG_LEVEL as AppConfig["logLevel"]) || "info",
  outputDir: path.resolve(backendRoot, process.env.OUTPUT_DIR || "outputs"),
  models: [
    {
      name: defaultModelName,
      model: defaultModelName,
      displayName: process.env.LLM_DISPLAY_NAME || "Default Research Model",
      description: "Primary model used by the lead research agent",
      apiKey: process.env.OPENAI_API_KEY || "",
      temperature: Number.parseFloat(process.env.LLM_TEMPERATURE || "0.2"),
      topP: process.env.LLM_TOP_P ? Number.parseFloat(process.env.LLM_TOP_P) : undefined,
      supportsThinking: true,
      supportsVision: false
    }
  ],
  tools: [
    {
      name: "web_search",
      description: "Search the web for research sources",
      group: "research"
    },
    {
      name: "web_fetch",
      description: "Fetch web page content for deeper analysis",
      group: "research"
    },
    {
      name: "present_file",
      description: "Present a generated file to the caller",
      group: "artifacts"
    }
  ],
  research: {
    searchProvider: "tavily",
    tavilyApiKey: process.env.TAVILY_API_KEY || "",
    searchTopK: Number.parseInt(process.env.SEARCH_TOP_K || "5", 10),
    searchConcurrency: Number.parseInt(process.env.SEARCH_CONCURRENCY || "3", 10),
    fetchMaxPages: Number.parseInt(process.env.FETCH_MAX_PAGES || "8", 10),
    maxIterations: Number.parseInt(process.env.RESEARCH_MAX_ITERATIONS || "1", 10),
    requestTimeoutMs: Number.parseInt(process.env.REQUEST_TIMEOUT_MS || "12000", 10),
    outputLanguage: process.env.OUTPUT_LANGUAGE || "zh-CN"
  },
  sandbox: {
    enabled: true,
    workspaceRoot: path.join(backendRoot, ".deep-research")
  }
});

export const getAppConfig = (): AppConfig => {
  if (!cachedConfig) {
    cachedConfig = buildDefaultConfig();
  }
  return cachedConfig;
};

export const reloadAppConfig = (): AppConfig => {
  cachedConfig = buildDefaultConfig();
  return cachedConfig;
};

export const getModelConfig = (name?: string) => {
  const appConfig = getAppConfig();
  if (!name) {
    return appConfig.models[0];
  }
  return appConfig.models.find((model) => model.name === name) || appConfig.models[0];
};
