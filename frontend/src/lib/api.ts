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

export interface HistoryRecord {
  threadId: string;
  title: string;
  topic: string;
  stats: { sources: number; iterations: number };
  createdAt: number;
  reportPath: string;
}

export interface ResearchHistoryResponse {
  total: number;
  records: HistoryRecord[];
}

export interface ResearchDetail {
  threadId: string;
  title: string;
  topic: string;
  report: string;
  reportPath: string;
  stats: { sources: number; iterations: number };
  createdAt: number;
}

/**
 * Done payload no longer carries the full `report` text — it was already
 * streamed via report_chunk events. Only metadata is included.
 */
export interface StreamDonePayload {
  threadId?: string;
  reportPath?: string;
  title?: string;
  stats?: { sources: number; iterations: number };
}

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

const parseSSEBlock = (block: string): ProgressEvent | null => {
  // 一个 SSE 块可能有多行 data:（续行），需要全部拼接
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("data: ")) {
      dataLines.push(line.slice(6));
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5));
    }
    // event: / id: / comment 行忽略，type 从 data JSON 里取
  }
  if (!dataLines.length) return null;
  try {
    return JSON.parse(dataLines.join("")) as ProgressEvent;
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

  const processBuffer = () => {
    // 以 \n\n 分割出完整的 SSE 块
    const parts = buffer.split("\n\n");
    // 最后一段可能不完整，留在 buffer
    buffer = parts.pop()!;
    for (const block of parts) {
      if (!block.trim()) continue;
      const event = parseSSEBlock(block);
      if (event) onEvent(event);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    processBuffer();
  }

  // 处理流结束后 buffer 中剩余的内容
  buffer += decoder.decode();
  processBuffer();
  // 以防万一没有 \n\n 结尾
  if (buffer.trim()) {
    const event = parseSSEBlock(buffer);
    if (event) onEvent(event);
  }
};

export const api = {
  getLatestResearch: () =>
    request<{
      threadId: string;
      reportPath: string;
      report: string;
      title: string;
    } | null>("/api/research/latest"),
  listResearchHistory: (page = 1, pageSize = 20) =>
    request<ResearchHistoryResponse>(`/api/research/history?page=${page}&pageSize=${pageSize}`),
  getResearchByThreadId: (threadId: string) =>
    request<ResearchDetail>(`/api/research/${encodeURIComponent(threadId)}`),
  deleteResearch: (threadId: string) =>
    request<{ success: boolean }>(`/api/research/${encodeURIComponent(threadId)}`, { method: "DELETE" })
};
