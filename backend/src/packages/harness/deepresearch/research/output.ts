const cleanupInvalidCitations = (content: string) => {
  const validIds = new Set(Array.from(content.matchAll(/- \[(S\d+)\] \[/g)).map((match) => match[1]));
  return content.replace(/\[(S\d+)\]/g, (full, citationId: string) => (validIds.has(citationId) ? full : ""));
};

export const normalizeReportContent = (content: string, topic: string) => {
  let normalized = cleanupInvalidCitations(content.replace(/\r\n/g, "\n").trim());

  const fencedMatch = normalized.match(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/i);
  if (fencedMatch) {
    normalized = fencedMatch[1].trim();
  }

  normalized = normalized
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  if (!/^#\s+/m.test(normalized)) {
    normalized = `# ${topic}\n\n${normalized}`;
  }

  return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
};
