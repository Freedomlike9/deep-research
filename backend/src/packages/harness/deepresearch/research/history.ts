import fs from "node:fs/promises";
import path from "node:path";
import { threadRoot } from "../config/paths.ts";

interface LatestReportResult {
  threadId: string;
  reportPath: string;
  report: string;
  title: string;
}

const getDirectoryEntries = async (targetPath: string) => {
  try {
    return await fs.readdir(targetPath, { withFileTypes: true });
  } catch {
    return [];
  }
};

export const getLatestReport = async (): Promise<LatestReportResult | null> => {
  const threadDirs = await getDirectoryEntries(threadRoot);
  const candidates: Array<LatestReportResult & { mtimeMs: number }> = [];

  for (const entry of threadDirs) {
    if (!entry.isDirectory()) {
      continue;
    }
    const outputsPath = path.join(threadRoot, entry.name, "user-data", "outputs");
    const files = await getDirectoryEntries(outputsPath);
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".md")) {
        continue;
      }
      const reportPath = path.join(outputsPath, file.name);
      const stats = await fs.stat(reportPath);
      const report = await fs.readFile(reportPath, "utf8");
      const firstHeading =
        report
          .split("\n")
          .find((line) => line.trim().startsWith("# "))
          ?.replace(/^#\s+/, "")
          .trim() || file.name.replace(/\.md$/, "");
      candidates.push({
        threadId: entry.name,
        reportPath,
        report,
        title: firstHeading,
        mtimeMs: stats.mtimeMs
      });
    }
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  if (!candidates.length) {
    return null;
  }

  const { mtimeMs: _mtimeMs, ...latest } = candidates[0];
  return latest;
};
