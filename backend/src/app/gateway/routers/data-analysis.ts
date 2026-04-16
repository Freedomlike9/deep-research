import path from "node:path";
import { runDataAnalysis } from "../../../packages/harness/deepresearch/skills/runtime/data-analysis.ts";

export const runDataAnalysisRoute = async (payload: {
  files?: string[];
  action?: "inspect" | "query" | "summary";
  sql?: string;
  table?: string;
  outputFile?: string;
}) => {
  if (!payload.files?.length) {
    throw new Error("files are required");
  }
  if (!payload.action) {
    throw new Error("action is required");
  }

  return runDataAnalysis({
    files: payload.files.map((file) => path.resolve(file)),
    action: payload.action,
    sql: payload.sql,
    table: payload.table,
    outputFile: payload.outputFile ? path.resolve(payload.outputFile) : undefined
  });
};
