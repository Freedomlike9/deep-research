import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { backendRoot } from "../../config/paths.ts";

const execFileAsync = promisify(execFile);
const dataAnalysisScriptPath = path.resolve(
  backendRoot,
  "../skills/public/data-analysis/scripts/analyze.py"
);

export interface DataAnalysisInput {
  files: string[];
  action: "inspect" | "query" | "summary";
  sql?: string;
  table?: string;
  outputFile?: string;
}

export const runDataAnalysis = async ({
  files,
  action,
  sql,
  table,
  outputFile
}: DataAnalysisInput) => {
  const args = [dataAnalysisScriptPath, "--files", ...files, "--action", action];
  if (sql) {
    args.push("--sql", sql);
  }
  if (table) {
    args.push("--table", table);
  }
  if (outputFile) {
    args.push("--output-file", outputFile);
  }

  const { stdout, stderr } = await execFileAsync("python3", args, {
    env: process.env,
    maxBuffer: 1024 * 1024 * 10
  });

  return {
    output: stdout.trim(),
    error: stderr.trim()
  };
};
