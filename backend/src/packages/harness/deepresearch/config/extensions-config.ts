import fs from "node:fs";
import path from "node:path";
import { backendRoot } from "./paths.ts";

export interface McpInlineResource {
  title: string;
  content: string;
}

export interface McpServerConfig {
  enabled: boolean;
  type: "inline" | "http";
  description: string;
  url?: string;
  headers?: Record<string, string>;
  resources?: McpInlineResource[];
}

export interface SkillStateConfig {
  enabled: boolean;
}

export interface ExtensionsConfig {
  mcpServers: Record<string, McpServerConfig>;
  skills: Record<string, SkillStateConfig>;
}

const configPath = path.resolve(backendRoot, "../extensions-config.json");

const defaultConfig: ExtensionsConfig = {
  mcpServers: {
    researchMemory: {
      enabled: true,
      type: "inline",
      description: "Reusable research heuristics and reporting constraints",
      resources: [
        {
          title: "Research Memory",
          content:
            "Prefer official docs, recent reports, and direct sources. Surface disagreements explicitly. Keep claims cited."
        }
      ]
    }
  },
  skills: {
    "deep-research": { enabled: true },
    "github-deep-research": { enabled: true }
  }
};

const ensureConfigFile = () => {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf8");
  }
};

export const getExtensionsConfigPath = () => configPath;

export const loadExtensionsConfig = (): ExtensionsConfig => {
  ensureConfigFile();
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ExtensionsConfig>;
    return {
      mcpServers: parsed.mcpServers || defaultConfig.mcpServers,
      skills: parsed.skills || defaultConfig.skills
    };
  } catch {
    return defaultConfig;
  }
};

export const saveExtensionsConfig = (config: ExtensionsConfig) => {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  return config;
};
