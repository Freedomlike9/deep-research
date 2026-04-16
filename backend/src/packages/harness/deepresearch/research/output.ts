import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, safeSlug } from "../utils/fs.ts";

export const normalizeReportContent = (content: string, topic: string) => {
  let normalized = content.replace(/\r\n/g, "\n").trim();

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

export const saveReport = async ({
  outputDir,
  topic,
  content
}: {
  outputDir: string;
  topic: string;
  content: string;
}) => {
  await ensureDir(outputDir);
  const filePath = path.join(outputDir, `${safeSlug(topic)}.md`);
  await fs.writeFile(filePath, normalizeReportContent(content, topic), "utf8");
  return filePath;
};
