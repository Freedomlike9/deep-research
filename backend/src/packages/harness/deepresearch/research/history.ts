import { getLatestRecord, getRecord } from "./db.ts";

interface LatestReportResult {
  threadId: string;
  reportPath: string;
  report: string;
  title: string;
}

export const getLatestReport = async (): Promise<LatestReportResult | null> => {
  const record = getLatestRecord();
  if (!record) return null;

  return {
    threadId: record.threadId,
    reportPath: record.reportPath,
    report: record.reportContent,
    title: record.title
  };
};

export const getReportByThreadId = async (
  threadId: string
): Promise<(LatestReportResult & { topic: string; stats: { sources: number; iterations: number }; createdAt: number }) | null> => {
  const record = getRecord(threadId);
  if (!record) return null;

  return {
    threadId: record.threadId,
    reportPath: record.reportPath,
    report: record.reportContent,
    title: record.title,
    topic: record.topic,
    stats: { sources: record.sources, iterations: record.iterations },
    createdAt: record.createdAt
  };
};
