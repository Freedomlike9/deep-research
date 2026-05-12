import { sanitizeText } from "./sanitize.ts";

export interface FetchPageResult {
  content: string;
  contentType?: string;
  finalUrl: string;
  fetchStatus: "fetched" | "failed" | "skipped";
  extractionMethod?: "html";
  fetchedAt?: number;
  statusCode?: number;
  failureReason?: string;
}

const isRetryableFetchError = (message: string, statusCode?: number) => {
  if (statusCode && [408, 425, 429, 500, 502, 503, 504].includes(statusCode)) {
    return true;
  }
  return /(timeout|timed out|aborted|ECONNRESET|ETIMEDOUT|fetch failed)/i.test(message);
};

const extractTextFromHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<\/(?:p|div|li|tr|h[1-6]|blockquote|section|article|main)>/gi, "\n")
    .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
    .replace(/<title[^>]*>([\s\S]*?)<\/title>/gi, "\n$1\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&\w+;/g, " ");

export const fetchPageText = async (url: string, timeoutMs: number): Promise<FetchPageResult> => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; deep-research-agent/1.0; +https://github.com/nicepkg/deerflow)",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7"
        }
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        const failureReason = `HTTP ${response.status}`;
        if (attempt === 0 && isRetryableFetchError(failureReason, response.status)) {
          continue;
        }
        return {
          content: "",
          contentType,
          finalUrl: response.url || url,
          fetchStatus: "failed",
          statusCode: response.status,
          failureReason
        };
      }

      if (
        !contentType.includes("text/html") &&
        !contentType.includes("text/plain") &&
        !contentType.includes("application/xhtml")
      ) {
        return {
          content: "",
          contentType,
          finalUrl: response.url || url,
          fetchStatus: "skipped",
          statusCode: response.status,
          failureReason: `Unsupported content type: ${contentType || "unknown"}`
        };
      }

      const raw = await response.text();
      const text = contentType.includes("text/plain") ? raw : extractTextFromHtml(raw);
      return {
        content: sanitizeText(text, 6000),
        contentType,
        finalUrl: response.url || url,
        fetchStatus: "fetched",
        extractionMethod: "html",
        fetchedAt: Date.now(),
        statusCode: response.status
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 0 && isRetryableFetchError(message)) {
        continue;
      }
      return {
        content: "",
        finalUrl: url,
        fetchStatus: "failed",
        failureReason: message
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    content: "",
    finalUrl: url,
    fetchStatus: "failed",
    failureReason: "Unknown fetch failure"
  };
};
