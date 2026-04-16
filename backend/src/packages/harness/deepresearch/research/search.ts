import type { ResearchConfig } from "../config/types.ts";

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  query?: string;
}

export interface SearchClient {
  invoke(input: { query: string }): Promise<unknown>;
}

const normalizeSearchResults = (raw: unknown): SearchResultItem[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const value = item as Record<string, unknown>;
        return {
          title: String(value.title || value.name || "Untitled"),
          url: String(value.url || value.link || ""),
          snippet: String(value.content || value.snippet || "")
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
