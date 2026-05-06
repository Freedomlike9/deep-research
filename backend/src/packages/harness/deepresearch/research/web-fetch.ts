import { sanitizeText } from "./sanitize.ts";

export interface FetchPageResult {
  content: string;
  contentType?: string;
  finalUrl: string;
  fetchStatus: "fetched" | "failed" | "skipped";
  extractionMethod?: "html";
  fetchedAt?: number;
}

export const fetchPageText = async (url: string, timeoutMs: number): Promise<FetchPageResult> => {
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
    // Skip non-HTML responses (PDFs, images, etc.)
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/xhtml")
    ) {
      return {
        content: "",
        contentType,
        finalUrl: response.url || url,
        fetchStatus: "skipped"
      };
    }

    const html = await response.text();

    // Strip HTML to plain text
    const text = html
      // Remove non-content blocks
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      // Remove forms (login, search boxes, comment forms)
      .replace(/<form[\s\S]*?<\/form>/gi, " ")
      // Convert block elements to newlines for structure preservation
      .replace(/<\/(?:p|div|li|tr|h[1-6]|blockquote|section|article)>/gi, "\n")
      .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
      // Strip remaining tags
      .replace(/<[^>]+>/g, " ")
      // Decode common HTML entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&\w+;/g, " ");

    // Sanitize and truncate
    return {
      content: sanitizeText(text, 6000),
      contentType,
      finalUrl: response.url || url,
      fetchStatus: "fetched",
      extractionMethod: "html",
      fetchedAt: Date.now()
    };
  } catch {
    return {
      content: "",
      finalUrl: url,
      fetchStatus: "failed"
    };
  } finally {
    clearTimeout(timer);
  }
};
