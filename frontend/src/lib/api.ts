export interface SkillItem {
  name: string;
  description: string;
  category: string;
  enabled: boolean;
}

export interface McpServerItem {
  enabled: boolean;
  type: string;
  description: string;
  url?: string;
  resources?: Array<{ title: string; content: string }>;
}

export interface ResearchDebug {
  usedSkills: Array<{ name: string; description: string }>;
  mcpResources: Array<{ title: string }>;
}

export type ProgressEventType =
  | "step_start"
  | "step_complete"
  | "search_result"
  | "source_fetched"
  | "iteration"
  | "report_chunk"
  | "done"
  | "error";

export type ResearchStep =
  | "skill_routing"
  | "plan"
  | "search"
  | "fetch"
  | "analyze"
  | "quality"
  | "report";

export interface ProgressEvent {
  type: ProgressEventType;
  step?: ResearchStep;
  message: string;
  data?: unknown;
  progress?: {
    current: number;
    total: number;
  };
  timestamp: number;
}

export interface ResearchResult {
  threadId?: string;
  reportPath: string;
  report: string;
  title?: string;
  stats: { sources: number; iterations: number };
  debug?: ResearchDebug;
}

export interface StreamDonePayload extends ResearchResult {}

export interface ReportChunkPayload {
  chunk: string;
  totalLength: number;
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8001";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {})
    },
    ...init
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
};

const parseSSELine = (line: string): ProgressEvent | null => {
  if (!line.startsWith("data: ")) return null;
  try {
    return JSON.parse(line.slice(6)) as ProgressEvent;
  } catch {
    return null;
  }
};

export const streamResearch = async (
  payload: { topic: string; language: string; dryRun?: boolean },
  onEvent: (event: ProgressEvent) => void
): Promise<void> => {
  const response = await fetch(`${baseUrl}/api/research/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop()!;

    for (const part of parts) {
      const lines = part.split("\n");
      for (const line of lines) {
        const event = parseSSELine(line);
        if (event) {
          onEvent(event);
        }
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    const lines = buffer.split("\n");
    for (const line of lines) {
      const event = parseSSELine(line);
      if (event) {
        onEvent(event);
      }
    }
  }
};

export const api = {
  listSkills: () => request<{ skills: SkillItem[] }>("/api/skills"),
  updateSkill: (skillName: string, enabled: boolean) =>
    request(`/api/skills/${encodeURIComponent(skillName)}`, {
      method: "PUT",
      body: JSON.stringify({ enabled })
    }),
  getMcpConfig: () => request<{ mcpServers: Record<string, McpServerItem> }>("/api/mcp/config"),
  runResearch: (payload: { topic: string; language: string; dryRun: boolean }) =>
    request<ResearchResult>("/api/research", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getLatestResearch: () =>
    request<{
      threadId: string;
      reportPath: string;
      report: string;
      title: string;
    } | null>("/api/research/latest")
};
