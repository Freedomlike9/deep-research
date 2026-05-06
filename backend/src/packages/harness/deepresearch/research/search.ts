import type { ResearchConfig } from "../config/types.ts";
import type { ResearchSource } from "./types.ts";

export type SearchResultItem = ResearchSource;

export interface SearchClient {
  invoke(input: { query: string }): Promise<unknown>;
}

const buildSourceId = (url: string) => Buffer.from(url).toString("base64url").slice(0, 24);

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const buildInitialScore = (domain: string, snippet: string): ResearchSource["score"] => {
  const authority = /(github\.com|docs\.|developer\.|openai\.com|anthropic\.com|mozilla\.org|wikipedia\.org)$/.test(domain)
    ? 0.9
    : domain
      ? 0.5
      : 0.2;
  const relevance = Math.min(1, Math.max(0.2, snippet.length / 240));
  const completeness = snippet ? 0.4 : 0.1;
  return {
    authority,
    relevance,
    completeness,
    total: Number(((authority * 0.4) + (relevance * 0.4) + (completeness * 0.2)).toFixed(3))
  };
};

const normalizeSearchResults = (raw: unknown): SearchResultItem[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const value = item as Record<string, unknown>;
        const title = String(value.title || value.name || "Untitled");
        const url = String(value.url || value.link || "");
        const snippet = String(value.content || value.snippet || "");
        const domain = getDomain(url);
        return {
          id: buildSourceId(url),
          title,
          url,
          domain,
          snippet,
          query: typeof value.query === "string" ? value.query : undefined,
          fetchStatus: "raw" as const,
          extractionMethod: "snippet" as const,
          score: buildInitialScore(domain, snippet)
        };
      })
      .filter((item): item is SearchResultItem => Boolean(item && item.url));
  }
  if (typeof raw === "string") {
    try {
      return normalizeSearchResults(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
};

export const createSearchClient = (config: ResearchConfig): SearchClient => {
  if (config.searchProvider !== "tavily") {
    throw new Error(`Unsupported search provider: ${config.searchProvider}`);
  }
  if (!config.tavilyApiKey) {
    throw new Error("TAVILY_API_KEY is required for Tavily search");
  }
  return {
    invoke: async ({ query }: { query: string }) => {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          api_key: config.tavilyApiKey,
          query,
          max_results: config.searchTopK,
          search_depth: "advanced"
        })
      });
      if (!response.ok) {
        throw new Error(`Tavily request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as {
        results?: Array<{ title?: string; url?: string; content?: string }>;
      };
      return (payload.results || []).map((item) => ({
        title: item.title || "Untitled",
        url: item.url || "",
        content: item.content || ""
      }));
    }
  };
};

export const runSearchQuery = async (client: SearchClient, query: string) => {
  const result = await client.invoke({ query });
  return normalizeSearchResults(result);
};
