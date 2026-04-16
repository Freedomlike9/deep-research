import { Annotation, StateGraph } from "@langchain/langgraph";
import pLimit from "p-limit";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";
import { buildAnalysisPrompt, buildPlanPrompt, buildQualityCheckPrompt, buildReportPrompt } from "./prompts.ts";
import { fetchPageText } from "./web-fetch.ts";
import { runSearchQuery, type SearchClient, type SearchResultItem } from "./search.ts";
import type { ResearchConfig } from "../config/types.ts";
import { emitProgress, type OnProgress } from "./progress.ts";
import type { TextGenerationModel } from "../models/factory.ts";

export interface ResearchPlan {
  angles: string[];
  queries: string[];
}

export interface ResearchState {
  topic: string;
  language: string;
  plan: ResearchPlan | null;
  queries: string[];
  searchResults: Array<{ query: string; results: SearchResultItem[] }>;
  sources: SearchResultItem[];
  notes: string;
  needsMore: boolean;
  report: string;
  iteration: number;
  /** Track which source URLs have already been analyzed to avoid re-sending */
  analyzedUrls: string[];
}

const ResearchStateAnnotation = Annotation.Root({
  topic: Annotation<string>,
  language: Annotation<string>,
  plan: Annotation<ResearchPlan | null>,
  queries: Annotation<string[]>,
  searchResults: Annotation<Array<{ query: string; results: SearchResultItem[] }>>,
  sources: Annotation<SearchResultItem[]>,
  notes: Annotation<string>,
  needsMore: Annotation<boolean>,
  report: Annotation<string>,
  iteration: Annotation<number>,
  analyzedUrls: Annotation<string[]>
});

const planSchema = z.object({
  angles: z.array(z.string()).min(3),
  queries: z.array(z.string()).min(4)
});

const qualitySchema = z.object({
  needsMore: z.boolean(),
  newQueries: z.array(z.string()).optional().default([])
});

const uniqueByUrl = (items: SearchResultItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) {
      return false;
    }
    seen.add(item.url);
    return true;
  });
};

const uniqueStrings = (items: string[]) =>
  Array.from(new Set(items.filter(Boolean)));

/**
 * OPTIMIZATION: Serialize sources compactly. Only include content for sources
 * that have it, and truncate to keep token budget reasonable.
 */
const serializeSources = (sources: SearchResultItem[]) =>
  sources
    .map(
      (item) =>
        `标题：${item.title}\nURL：${item.url}\n摘要：${item.snippet}${item.content ? `\n正文：${item.content}` : ""}`
    )
    .join("\n\n");

/**
 * OPTIMIZATION: Build a lightweight source index (title + URL only) for the report step.
 * The report step relies on notes (which contain citations) rather than raw source text.
 */
const buildSourceIndex = (sources: SearchResultItem[]) =>
  sources
    .map((item, i) => `[${i + 1}] ${item.title} — ${item.url}`)
    .join("\n");

const serializePlan = (plan: ResearchPlan) =>
  plan.angles.map((angle) => `- ${angle}`).join("\n");

const buildFastQueries = (topic: string, language: string) =>
  uniqueStrings([
    topic,
    `${topic} architecture`,
    `${topic} workflow`,
    `${topic} overview`,
    language.startsWith("zh") ? `${topic} 核心架构` : `${topic} key architecture`
  ]).slice(0, 3);

const routeAfterSearch = (config: ResearchConfig) => () =>
  config.fetchMaxPages > 0 ? "fetch_step" : "analyze_step";

const routeAfterAnalyze = (config: ResearchConfig) => () =>
  config.maxIterations > 1 ? "quality_step" : "report_step";

const routeAfterQuality = (state: typeof ResearchStateAnnotation.State) =>
  state.needsMore ? "search_step" : "report_step";

/**
 * OPTIMIZATION: Cap the number of sources sent to LLM to avoid blowing up context.
 * Prioritize sources that have fetched content, then by recency in results.
 */
const selectTopSources = (sources: SearchResultItem[], maxCount: number): SearchResultItem[] => {
  if (sources.length <= maxCount) return sources;
  // Prioritize sources with content
  const withContent = sources.filter((s) => s.content);
  const withoutContent = sources.filter((s) => !s.content);
  const selected = [...withContent.slice(0, maxCount)];
  if (selected.length < maxCount) {
    selected.push(...withoutContent.slice(0, maxCount - selected.length));
  }
  return selected;
};

/** Max sources to send per analyze call */
const ANALYZE_MAX_SOURCES = 15;

export const buildResearchGraph = ({
  model,
  searchClient,
  config,
  onProgress
}: {
  model: TextGenerationModel;
  searchClient: SearchClient;
  config: ResearchConfig;
  onProgress?: OnProgress;
}) => {
  const planParser = StructuredOutputParser.fromZodSchema(planSchema);
  const qualityParser = StructuredOutputParser.fromZodSchema(qualitySchema);

  const extractTextContent = (value: unknown): string => {
    if (typeof value === "string") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => extractTextContent(item)).join("");
    }
    if (value && typeof value === "object") {
      const candidate = value as Record<string, unknown>;
      if (typeof candidate.text === "string") {
        return candidate.text;
      }
      if (typeof candidate.content === "string") {
        return candidate.content;
      }
      if (candidate.content !== undefined) {
        return extractTextContent(candidate.content);
      }
    }
    return "";
  };

  const planNode = async (state: ResearchState) => {
    emitProgress(onProgress, {
      type: "step_start",
      step: "plan",
      message: "正在规划研究角度与搜索查询..."
    });
    const prompt = buildPlanPrompt({
      topic: state.topic,
      language: state.language,
      formatInstructions: planParser.getFormatInstructions()
    });
    const response = await model.invoke(prompt);
    const plan = await planParser.parse(response.content);
    emitProgress(onProgress, {
      type: "step_complete",
      step: "plan",
      message: `规划完成：${plan.angles.length} 个研究角度，${plan.queries.length} 条搜索查询`,
      data: { angles: plan.angles, queryCount: plan.queries.length }
    });
    return {
      plan,
      queries: plan.queries,
      iteration: state.iteration
    };
  };

  const searchNode = async (state: ResearchState) => {
    const total = state.queries.length;
    emitProgress(onProgress, {
      type: "step_start",
      step: "search",
      message: `正在并发搜索 ${total} 条查询...`,
      progress: { current: 0, total }
    });
    const limit = pLimit(config.searchConcurrency);
    let completed = 0;
    const tasks = state.queries.map((query) =>
      limit(async () => {
        const results = await runSearchQuery(searchClient, query);
        completed++;
        emitProgress(onProgress, {
          type: "search_result",
          step: "search",
          message: `搜索进度 (${completed}/${total})：${query.slice(0, 40)}`,
          progress: { current: completed, total }
        });
        return { query, results };
      })
    );
    const searchResults = await Promise.all(tasks);
    const flattened = searchResults.flatMap((item) =>
      item.results.map((result) => ({
        ...result,
        query: item.query
      }))
    );
    const sources = uniqueByUrl([...(state.sources || []), ...flattened]);
    emitProgress(onProgress, {
      type: "step_complete",
      step: "search",
      message: `搜索完成：共获取 ${sources.length} 条去重来源`,
      progress: { current: total, total }
    });
    return {
      searchResults,
      sources,
      iteration: state.iteration
    };
  };

  const fetchNode = async (state: ResearchState) => {
    const uniqueSources = uniqueByUrl(state.sources || []);
    const toFetch = uniqueSources
      .filter((item) => !item.content)
      .slice(0, config.fetchMaxPages);
    const total = toFetch.length;
    emitProgress(onProgress, {
      type: "step_start",
      step: "fetch",
      message: `正在抓取 ${total} 个网页正文...`,
      progress: { current: 0, total }
    });
    const limit = pLimit(config.searchConcurrency);
    let completed = 0;
    const fetched = await Promise.all(
      toFetch.map((item) =>
        limit(async () => {
          const content = await fetchPageText(item.url, config.requestTimeoutMs);
          completed++;
          emitProgress(onProgress, {
            type: "source_fetched",
            step: "fetch",
            message: `抓取进度 (${completed}/${total})：${item.title?.slice(0, 30) || item.url}`,
            progress: { current: completed, total }
          });
          return { ...item, content };
        })
      )
    );
    emitProgress(onProgress, {
      type: "step_complete",
      step: "fetch",
      message: `抓取完成：成功获取 ${fetched.filter((item) => item.content).length}/${total} 个页面正文`,
      progress: { current: total, total }
    });
    return {
      sources: uniqueByUrl(
        uniqueSources.map((item) => fetched.find((candidate) => candidate.url === item.url) || item)
      ),
      iteration: state.iteration
    };
  };

  /**
   * OPTIMIZATION: Incremental analysis.
   * - Round 1: analyze all sources (capped at ANALYZE_MAX_SOURCES).
   * - Round 2+: only analyze NEW sources not yet analyzed, then merge notes.
   */
  const analyzeNode = async (state: ResearchState) => {
    const allSources = state.sources || [];
    const analyzedSet = new Set(state.analyzedUrls || []);
    const isFirstRound = analyzedSet.size === 0;

    // Filter to only new sources for incremental rounds
    const candidateSources = isFirstRound
      ? allSources
      : allSources.filter((s) => !analyzedSet.has(s.url));

    const toAnalyze = selectTopSources(candidateSources, ANALYZE_MAX_SOURCES);

    emitProgress(onProgress, {
      type: "step_start",
      step: "analyze",
      message: `正在分析 ${toAnalyze.length} 条${isFirstRound ? "" : "新增"}来源并整理研究笔记...`
    });

    if (toAnalyze.length === 0) {
      // No new sources to analyze
      return {
        notes: state.notes,
        analyzedUrls: [...analyzedSet],
        iteration: state.iteration
      };
    }

    const prompt = buildAnalysisPrompt({
      topic: state.topic,
      language: state.language,
      sources: serializeSources(toAnalyze)
    });
    const response = await model.invoke(prompt);

    // Merge notes: append new findings to existing notes
    const mergedNotes = state.notes
      ? `${state.notes}\n\n${isFirstRound ? "--- 研究分析 ---" : "--- 补充研究 ---"}\n${response.content}`
      : response.content;

    // Track which URLs have been analyzed
    const newAnalyzedUrls = [
      ...analyzedSet,
      ...toAnalyze.map((s) => s.url)
    ];

    emitProgress(onProgress, {
      type: "step_complete",
      step: "analyze",
      message: "分析完成：研究笔记已整理"
    });
    return {
      notes: mergedNotes,
      analyzedUrls: newAnalyzedUrls,
      iteration: state.iteration
    };
  };

  const qualityNode = async (state: ResearchState) => {
    emitProgress(onProgress, {
      type: "step_start",
      step: "quality",
      message: `正在检查研究完整性（第 ${state.iteration + 1} 轮）...`
    });
    const prompt = buildQualityCheckPrompt({
      topic: state.topic,
      language: state.language,
      notes: state.notes,
      formatInstructions: qualityParser.getFormatInstructions()
    });
    const response = await model.invoke(prompt);
    const parsed = await qualityParser.parse(response.content);
    const needsMore = parsed.needsMore && state.iteration < config.maxIterations;
    if (needsMore) {
      emitProgress(onProgress, {
        type: "iteration",
        step: "quality",
        message: `质量检查：信息不足，将补充搜索 ${(parsed.newQueries || []).length} 条新查询（进入第 ${state.iteration + 2} 轮）`,
        data: { newQueries: parsed.newQueries }
      });
    } else {
      emitProgress(onProgress, {
        type: "step_complete",
        step: "quality",
        message: "质量检查通过：研究覆盖度充分，准备生成报告"
      });
    }
    return {
      needsMore,
      queries: uniqueStrings([...(state.queries || []), ...(parsed.newQueries || [])]),
      iteration: state.iteration + 1
    };
  };

  /**
   * OPTIMIZATION: Report step now uses notes as primary input + lightweight source index.
   * Raw source content is NOT re-sent — all key information is already in notes.
   */
  const reportNode = async (state: ResearchState) => {
    emitProgress(onProgress, {
      type: "step_start",
      step: "report",
      message: `正在基于研究笔记生成报告...`
    });
    const prompt = buildReportPrompt({
      topic: state.topic,
      language: state.language,
      plan: state.plan ? serializePlan(state.plan) : "",
      notes: state.notes,
      sourceList: buildSourceIndex(state.sources || [])
    });
    let report = "";

    if (typeof model.stream === "function") {
      const stream = await model.stream(prompt);
      for await (const chunk of stream) {
        const text = extractTextContent(chunk);
        if (!text) {
          continue;
        }
        report += text;
        emitProgress(onProgress, {
          type: "report_chunk",
          step: "report",
          message: `正在生成报告正文...`,
          data: {
            chunk: text,
            totalLength: report.length
          }
        });
      }
    }

    if (!report) {
      const response = await model.invoke(prompt);
      report = response.content;
      emitProgress(onProgress, {
        type: "report_chunk",
        step: "report",
        message: "正在生成报告正文...",
        data: {
          chunk: report,
          totalLength: report.length
        }
      });
    }

    emitProgress(onProgress, {
      type: "step_complete",
      step: "report",
      message: "报告生成完成"
    });
    return {
      report,
      iteration: state.iteration
    };
  };

  const bootstrapNode = async (state: ResearchState) => {
    if (config.fetchMaxPages === 0 && config.maxIterations <= 1) {
      const queries = buildFastQueries(state.topic, state.language);
      emitProgress(onProgress, {
        type: "step_complete",
        step: "plan",
        message: `快速模式：生成 ${queries.length} 条查询`,
        data: { angles: ["概览", "架构", "流程"], queryCount: queries.length }
      });
      return {
        plan: {
          angles: ["概览", "架构", "流程"],
          queries
        },
        queries
      };
    }
    return planNode(state);
  };

  return new StateGraph(ResearchStateAnnotation)
    .addNode("plan_step", bootstrapNode)
    .addNode("search_step", searchNode)
    .addNode("fetch_step", fetchNode)
    .addNode("analyze_step", analyzeNode)
    .addNode("quality_step", qualityNode)
    .addNode("report_step", reportNode)
    .addEdge("__start__", "plan_step")
    .addEdge("plan_step", "search_step")
    .addConditionalEdges("search_step", routeAfterSearch(config))
    .addEdge("fetch_step", "analyze_step")
    .addConditionalEdges("analyze_step", routeAfterAnalyze(config))
    .addConditionalEdges("quality_step", routeAfterQuality)
    .addEdge("report_step", "__end__")
    .compile();
};
