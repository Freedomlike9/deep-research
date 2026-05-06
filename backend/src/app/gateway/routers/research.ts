import http from "node:http";
import { createChatModel, createDryRunModel } from "../../../packages/harness/deepresearch/models/factory.ts";
import { LeadResearchAgent } from "../../../packages/harness/deepresearch/agents/lead-agent/agent.ts";
import { getLatestReport, getReportByThreadId } from "../../../packages/harness/deepresearch/research/history.ts";
import { listRecords, deleteRecord } from "../../../packages/harness/deepresearch/research/db.ts";
import type { ProgressEvent } from "../../../packages/harness/deepresearch/research/progress.ts";

export const runResearchRoute = async (payload: {
  topic?: string;
  language?: string;
  dryRun?: boolean;
}) => {
  if (!payload.topic) {
    throw new Error("topic is required");
  }
  const agent = new LeadResearchAgent({
    model: payload.dryRun ? createDryRunModel() : createChatModel(),
    dryRun: Boolean(payload.dryRun)
  });
  const result = await agent.invoke({
    topic: payload.topic,
    language: payload.language || "zh-CN"
  });
  return {
    threadId: result.state.threadId,
    reportPath: result.reportPath,
    report: result.state.report,
    title: result.state.title,
    stats: result.stats,
    findings: result.state.findings,
    sourcesDetail: result.state.sources,
    debug: result.state.debug
  };
};

export const runResearchStreamRoute = async (
  payload: { topic?: string; language?: string; dryRun?: boolean },
  response: http.ServerResponse
) => {
  if (!payload.topic) {
    response.writeHead(400, {
      "content-type": "application/json",
      "access-control-allow-origin": "*"
    });
    response.end(JSON.stringify({ error: "topic is required" }));
    return;
  }

  response.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    "connection": "keep-alive",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
    "access-control-allow-headers": "content-type"
  });

  const sendEvent = (event: ProgressEvent) => {
    if (response.destroyed) return;
    response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };

  /**
   * Send the final event and wait for the write buffer to drain before
   * closing the response. This prevents the "stream ended before the
   * final result was delivered" error caused by response.end() racing
   * ahead of an unflushed large done-event payload.
   */
  const sendFinalEvent = (event: ProgressEvent): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (response.destroyed) {
        resolve();
        return;
      }
      const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
      const flushed = response.write(payload);
      if (flushed) {
        resolve();
      } else {
        response.once("drain", resolve);
      }
    });
  };

  try {
    const agent = new LeadResearchAgent({
      model: payload.dryRun ? createDryRunModel() : createChatModel(),
      dryRun: Boolean(payload.dryRun)
    });

    const result = await agent.invoke({
      topic: payload.topic,
      language: payload.language || "zh-CN",
      onProgress: sendEvent
    });

    // Done event carries only metadata — the full report text was already
    // streamed via report_chunk events. Removing `report` from the payload
    // shrinks the done event from potentially 30-100 KB to < 1 KB, which
    // eliminates buffer-flush race conditions.
    await sendFinalEvent({
      type: "done",
      message: "研究完成",
      data: {
        threadId: result.state.threadId,
        reportPath: result.reportPath,
        title: result.state.title,
        stats: result.stats
      },
      timestamp: Date.now()
    });
  } catch (error) {
    sendEvent({
      type: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now()
    });
  } finally {
    if (!response.destroyed) {
      response.end();
    }
  }
};

export const getLatestResearchRoute = async () => {
  const latest = await getLatestReport();
  if (!latest) {
    return null;
  }
  return latest;
};

export const getResearchHistoryRoute = ({ page, pageSize }: { page?: number; pageSize?: number }) => {
  const result = listRecords({ page, pageSize });
  return {
    total: result.total,
    records: result.records.map((record) => ({
      threadId: record.threadId,
      title: record.title,
      topic: record.topic,
      stats: { sources: record.sources, iterations: record.iterations },
      createdAt: record.createdAt,
      reportPath: record.reportPath
    }))
  };
};

export const getResearchByThreadIdRoute = async (threadId: string) => {
  return getReportByThreadId(threadId);
};

export const deleteResearchRoute = (threadId: string): { success: boolean } | null => {
  const deleted = deleteRecord(threadId);
  return deleted ? { success: true } : null;
};
