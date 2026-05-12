import { Annotation, StateGraph } from "@langchain/langgraph";
import pLimit from "p-limit";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";
import { buildAnalysisPrompt, buildPlanPrompt, buildQualityCheckPrompt, buildReportPrompt } from "./prompts.ts";
import { fetchPageText } from "./web-fetch.ts";
import { sanitizeText, sanitizeSnippet } from "./sanitize.ts";
import { runSearchQuery, type SearchClient } from "./search.ts";
import type { ResearchConfig } from "../config/types.ts";
import { emitProgress, type OnProgress } from "./progress.ts";
import type { TextGenerationModel } from "../models/factory.ts";
import type { QualityCheckResult, ResearchAnalysis, ResearchFinding, ResearchQueryPlan, ResearchSource, ResearchWorkingState } from "./types.ts";

export interface ResearchState extends ResearchWorkingState {}

const ResearchStateAnnotation = Annotation.Root({
  topic: Annotation<string>,
  language: Annotation<string>,
  plan: Annotation<ResearchQueryPlan | null>,
  queries: Annotation<string[]>,
  searchResults: Annotation<Array<{ query: string; results: ResearchSource[] }>>,
  sources: Annotation<ResearchSource[]>,
  findings: Annotation<ResearchFinding[]>,
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

const analysisSchema = z.object({
  summary: z.string(),
  findings: z.array(z.object({
    claim: z.string(),
    confidence: z.enum(["low", "medium", "high"]),
    evidence: z.array(z.object({
      sourceId: z.string(),
      title: z.string(),
      url: z.string(),
      summary: z.string()
    })).min(1),
    missingEvidence: z.array(z.string()).optional().default([])
  })).min(1),
  openQuestions: z.array(z.string()).optional().default([])
});

const qualitySchema = z.object({
  needsMore: z.boolean(),
  newQueries: z.array(z.string()).optional().default([]),
  uncoveredAngles: z.array(z.string()).optional().default([]),
  weakClaims: z.array(z.string()).optional().default([])
});

const getSourceIdentity = (item: ResearchSource) => item.finalUrl || item.url;

const uniqueByUrl = (items: ResearchSource[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const identity = getSourceIdentity(item);
    if (!identity || seen.has(identity)) {
      return false;
    }
    seen.add(identity);
    return true;
  });
};

const uniqueStrings = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

const scoreSource = (source: ResearchSource): ResearchSource => {
  const authority = /(github\.com|docs\.|developer\.|openai\.com|anthropic\.com|mozilla\.org|wikipedia\.org)$/.test(source.domain)
    ? 0.9
    : source.domain
      ? 0.5
      : 0.2;
  const relevance = Math.min(1, Math.max(0.2, (source.content || source.snippet).length / 1500));
  const completeness = source.content ? 1 : source.snippet ? 0.4 : 0.1;
  return {
    ...source,
    score: {
      authority,
      relevance,
      completeness,
      total: Number(((authority * 0.4) + (relevance * 0.35) + (completeness * 0.25)).toFixed(3))
    }
  };
};

const serializeSources = (sources: ResearchSource[]) =>
  sources
    .map((item) => {
      const snippet = sanitizeSnippet(item.snippet, 400);
      const content = item.content ? sanitizeText(item.content, 4000) : "";
      return `sourceId：${item.id}\n标题：${item.title}\nURL：${item.url}\n域名：${item.domain}\n摘要：${snippet}${content ? `\n正文：${content}` : ""}`;
    })
    .join("\n\n");

const buildCitationRegistry = (sources: ResearchSource[], findings: ResearchFinding[]) => {
  const sourceByKey = new Map<string, ResearchSource>();
  const register = (source: ResearchSource) => {
    sourceByKey.set(getSourceIdentity(source), source);
    sourceByKey.set(source.url, source);
  };

  for (const source of sources) {
    register(source);
  }

  const orderedSources: ResearchSource[] = [];
  const seen = new Set<string>();
  const push = (source?: ResearchSource) => {
    if (!source) return;
    const key = getSourceIdentity(source);
    if (!key || seen.has(key)) return;
    seen.add(key);
    orderedSources.push(source);
  };

  for (const finding of findings) {
    for (const evidence of finding.evidence) {
      push(sourceByKey.get(evidence.url));
    }
  }

  for (const source of sources) {
    push(source);
  }

  const citationByUrl = new Map<string, string>();
  orderedSources.forEach((source, index) => {
    const citationId = `S${index + 1}`;
    citationByUrl.set(source.url, citationId);
    if (source.finalUrl) {
      citationByUrl.set(source.finalUrl, citationId);
    }
  });

  return {
    orderedSources,
    citationByUrl
  };
};

const buildSourceIndex = (sources: ResearchSource[]) =>
  sources
    .map((item, i) => `- [S${i + 1}] [${item.title}](${item.finalUrl || item.url})`)
    .join("\n");

const serializeFindings = (findings: ResearchFinding[], citationByUrl: Map<string, string> = new Map()) =>
  findings
    .map((finding) => {
      const refs = finding.evidence
        .map((evidence: ResearchFinding["evidence"][number]) => citationByUrl.get(evidence.url) || evidence.citationId)
        .filter(Boolean)
        .map((citationId) => `[${citationId}]`)
        .join(" ");
      const gaps = finding.missingEvidence?.length ? `\n证据缺口：${finding.missingEvidence.join("；")}` : "";
      return `- 结论：${finding.claim}${refs ? ` ${refs}` : ""}\n  置信度：${finding.confidence}${gaps}`;
    })
    .join("\n");

const serializePlan = (plan: ResearchQueryPlan) => plan.angles.map((angle) => `- ${angle}`).join("\n");

const buildFastQueries = (topic: string, language: string) =>
  uniqueStrings([
    topic,
    `${topic} architecture`,
    `${topic} workflow`,
    `${topic} overview`,
    language.startsWith("zh") ? `${topic} 核心架构` : `${topic} key architecture`
  ]).slice(0, 3);

const routeAfterSearch = (config: ResearchConfig) => () => config.fetchMaxPages > 0 ? "fetch_step" : "analyze_step";
const routeAfterAnalyze = (config: ResearchConfig) => () => config.maxIterations >= 1 ? "quality_step" : "report_step";
const routeAfterQuality = (state: typeof ResearchStateAnnotation.State) => state.needsMore ? "search_step" : "report_step";

const selectTopSources = (sources: ResearchSource[], maxCount: number): ResearchSource[] => {
  const scored = sources.map(scoreSource).sort((a, b) => b.score.total - a.score.total);
  return scored.slice(0, maxCount);
};

const ANALYZE_MAX_SOURCES = 15;

const safeModelInvoke = async (
  model: TextGenerationModel,
  prompt: string,
  options: { retries?: number; label?: string } = {}
): Promise<{ content: string | unknown }> => {
  const { retries = 2, label = "LLM" } = options;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await model.invoke(prompt);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("high risk") ||
        message.includes("content_filter") ||
        message.includes("content management policy") ||
        (message.includes("400") && message.toLowerCase().includes("risk"))
      ) {
        throw new Error(
          `[${label}] 内容安全拦截：请求被 LLM API 拒绝。可能是研究主题或抓取的网页内容触发了风控策略。建议：调整研究主题描述，或检查来源内容。`
        );
      }
      const isRetryable =
        message.includes("429") ||
        message.includes("rate") ||
        message.includes("503") ||
        message.includes("502") ||
        message.includes("timeout") ||
        message.includes("ECONNRESET") ||
        message.includes("ETIMEDOUT");
      if (isRetryable && attempt < retries) {
        const delay = 1000 * (attempt + 1) + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
};

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
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map((item) => extractTextContent(item)).join("");
    if (value && typeof value === "object") {
      const candidate = value as Record<string, unknown>;
      if (typeof candidate.text === "string") return candidate.text;
      if (typeof candidate.content === "string") return candidate.content;
      if (candidate.content !== undefined) return extractTextContent(candidate.content);
    }
    return "";
  };

  const parseJsonObject = <T>(raw: string, fallback: T): T => {
    try {
      return JSON.parse(raw) as T;
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return fallback;
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return fallback;
      }
    }
  };

  const planNode = async (state: ResearchState) => {
    emitProgress(onProgress, { type: "step_start", step: "plan", message: "正在规划研究角度与搜索查询..." });
    const prompt = buildPlanPrompt({
      topic: state.topic,
      language: state.language,
      formatInstructions: planParser.getFormatInstructions()
    });
    const response = await safeModelInvoke(model, prompt, { label: "plan" });
    const plan = await planParser.parse(extractTextContent(response.content));
    emitProgress(onProgress, {
      type: "step_complete",
      step: "plan",
      message: `规划完成：${plan.angles.length} 个研究角度，${plan.queries.length} 条搜索查询`,
      data: { angles: plan.angles, queryCount: plan.queries.length }
    });
    return { plan, queries: plan.queries, iteration: state.iteration };
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
        return {
          query,
          results: results.map((result) => ({ ...result, query }))
        };
      })
    );
    const searchResults = await Promise.all(tasks);
    const flattened = searchResults.flatMap((item) => item.results);
    const sources = uniqueByUrl([...(state.sources || []), ...flattened]).map(scoreSource);
    emitProgress(onProgress, {
      type: "step_complete",
      step: "search",
      message: `搜索完成：共获取 ${sources.length} 条去重来源`,
      progress: { current: total, total }
    });
    return { searchResults, sources, iteration: state.iteration };
  };

  const fetchNode = async (state: ResearchState) => {
    const uniqueSources = uniqueByUrl(state.sources || []);
    const toFetch = uniqueSources.filter((item) => !item.content).slice(0, config.fetchMaxPages);
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
          const fetchedPage = await fetchPageText(item.url, config.requestTimeoutMs);
          completed++;
          emitProgress(onProgress, {
            type: "source_fetched",
            step: "fetch",
            message: `抓取进度 (${completed}/${total})：${item.title?.slice(0, 30) || item.url}`,
            progress: { current: completed, total }
          });
          return scoreSource({
            ...item,
            content: fetchedPage.content || item.content,
            contentType: fetchedPage.contentType,
            finalUrl: fetchedPage.finalUrl,
            fetchStatus: fetchedPage.fetchStatus,
            extractionMethod: fetchedPage.extractionMethod,
            fetchedAt: fetchedPage.fetchedAt
          });
        })
      )
    );
    emitProgress(onProgress, {
      type: "step_complete",
      step: "fetch",
      message: `抓取完成：成功获取 ${fetched.filter((item) => item.fetchStatus === "fetched").length}/${total} 个页面正文`,
      progress: { current: total, total }
    });
    return {
      sources: uniqueByUrl(uniqueSources.map((item) => fetched.find((candidate) => candidate.url === item.url) || item)).map(scoreSource),
      iteration: state.iteration
    };
  };

  const analyzeNode = async (state: ResearchState) => {
    const allSources = state.sources || [];
    const analyzedSet = new Set(state.analyzedUrls || []);
    const isFirstRound = analyzedSet.size === 0;
    const candidateSources = isFirstRound ? allSources : allSources.filter((s) => !analyzedSet.has(s.url));
    const toAnalyze = selectTopSources(candidateSources, ANALYZE_MAX_SOURCES);
    emitProgress(onProgress, {
      type: "step_start",
      step: "analyze",
      message: `正在分析 ${toAnalyze.length} 条${isFirstRound ? "" : "新增"}来源并整理研究发现...`
    });
    if (toAnalyze.length === 0) {
      return {
        notes: state.notes,
        findings: state.findings,
        analyzedUrls: [...analyzedSet],
        iteration: state.iteration
      };
    }

    const prompt = buildAnalysisPrompt({
      topic: state.topic,
      language: state.language,
      sources: serializeSources(toAnalyze)
    });
    const response = await safeModelInvoke(model, prompt, { label: "analyze" });
    const parsed = parseJsonObject<ResearchAnalysis>(extractTextContent(response.content), {
      summary: "",
      findings: [],
      openQuestions: []
    });
    const analysis = analysisSchema.parse(parsed);
    const mergedNotes = [state.notes, analysis.summary, analysis.findings.map((finding) => {
      const refs = finding.evidence.map((evidence: ResearchFinding["evidence"][number]) => `[${evidence.sourceId}]`).join(" ");
      return `- ${finding.claim} ${refs}（${finding.confidence}）`;
    }).join("\n"), analysis.openQuestions.length ? `待补充问题：${analysis.openQuestions.join("；")}` : ""]
      .filter(Boolean)
      .join("\n\n");
    const newAnalyzedUrls = [...analyzedSet, ...toAnalyze.map((s) => s.url)];
    emitProgress(onProgress, {
      type: "step_complete",
      step: "analyze",
      message: `分析完成：整理出 ${analysis.findings.length} 条研究发现`
    });
    return {
      notes: mergedNotes,
      findings: [...(state.findings || []), ...analysis.findings],
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
    const { citationByUrl } = buildCitationRegistry(state.sources || [], state.findings || []);
    const prompt = buildQualityCheckPrompt({
      topic: state.topic,
      language: state.language,
      notes: `${state.notes}\n\n结构化发现：\n${serializeFindings(state.findings || [], citationByUrl)}`,
      iteration: state.iteration,
      maxIterations: config.maxIterations,
      sourceCount: (state.sources || []).length,
      formatInstructions: qualityParser.getFormatInstructions()
    });
    const response = await safeModelInvoke(model, prompt, { label: "quality" });
    let parsed: QualityCheckResult;
    try {
      parsed = await qualityParser.parse(extractTextContent(response.content));
    } catch {
      parsed = {
        needsMore: (state.sources || []).length < 3 || (state.findings || []).length < 3,
        newQueries: [],
        uncoveredAngles: [],
        weakClaims: (state.findings || []).filter((finding) => finding.confidence === "low").map((finding) => finding.claim)
      };
    }
    const needsMore = Boolean(parsed.needsMore) && state.iteration < config.maxIterations;
    if (needsMore) {
      emitProgress(onProgress, {
        type: "iteration",
        step: "quality",
        message: `质量检查：发现 ${parsed.weakClaims.length} 条弱结论、${parsed.uncoveredAngles.length} 个缺失角度，将继续补充搜索`,
        data: {
          newQueries: parsed.newQueries,
          uncoveredAngles: parsed.uncoveredAngles,
          weakClaims: parsed.weakClaims
        }
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

  const reportNode = async (state: ResearchState) => {
    emitProgress(onProgress, {
      type: "step_start",
      step: "report",
      message: "正在基于研究发现生成报告..."
    });
    const { orderedSources, citationByUrl } = buildCitationRegistry(state.sources || [], state.findings || []);
    const normalizedFindings = (state.findings || []).map((finding) => ({
      ...finding,
      evidence: finding.evidence.map((evidence) => ({
        ...evidence,
        citationId: citationByUrl.get(evidence.url) || evidence.citationId
      }))
    }));
    const prompt = buildReportPrompt({
      topic: state.topic,
      language: state.language,
      plan: state.plan ? serializePlan(state.plan) : "",
      notes: `${state.notes}\n\n结构化发现：\n${serializeFindings(normalizedFindings, citationByUrl)}`,
      sourceList: buildSourceIndex(orderedSources)
    });
    let report = "";
    if (typeof model.stream === "function") {
      const stream = await model.stream(prompt);
      for await (const chunk of stream) {
        const text = extractTextContent(chunk);
        if (!text) continue;
        report += text;
        emitProgress(onProgress, {
          type: "report_chunk",
          step: "report",
          message: "正在生成报告正文...",
          data: { chunk: text, totalLength: report.length }
        });
      }
    }
    if (!report) {
      const response = await safeModelInvoke(model, prompt, { label: "report" });
      report = extractTextContent(response.content);
      emitProgress(onProgress, {
        type: "report_chunk",
        step: "report",
        message: "正在生成报告正文...",
        data: { chunk: report, totalLength: report.length }
      });
    }
    emitProgress(onProgress, { type: "step_complete", step: "report", message: "报告生成完成" });
    return { report, iteration: state.iteration };
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
        plan: { angles: ["概览", "架构", "流程"], queries },
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
