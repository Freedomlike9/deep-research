import { randomUUID } from "node:crypto";
import { getAppConfig } from "../../config/app-config.ts";
import { createDryRunModel, type TextGenerationModel } from "../../models/factory.ts";
import { buildResearchGraph } from "../../research/graph.ts";
import { normalizeReportContent } from "../../research/output.ts";
import { createSearchClient } from "../../research/search.ts";
import { emitProgress, type OnProgress } from "../../research/progress.ts";
import { upsertRecord } from "../../research/db.ts";
import { buildMcpPromptSection, resolveMcpResources } from "../../mcp/manager.ts";
import { buildSkillsPromptSection, loadSkills } from "../../skills/loader.ts";
import {
  orchestrateSkillRuntime,
  selectRelevantSkillsWithModel
} from "../../skills/runtime/orchestrator.ts";
import { buildLeadRuntimeMiddlewares } from "../middlewares/index.ts";
import { createInitialThreadState, type ThreadState } from "../thread-state.ts";
import { applyPromptTemplate } from "./prompt.ts";
import { getAvailableTools } from "../../tools/tools.ts";

export interface LeadAgentOptions {
  model: TextGenerationModel;
  dryRun?: boolean;
}

const mergeState = <T extends object>(state: T, patch?: Partial<T> | void): T =>
  patch ? { ...state, ...patch } : state;

export class LeadResearchAgent {
  private readonly options: LeadAgentOptions;

  constructor(options: LeadAgentOptions) {
    this.options = options;
  }

  async invoke({
    topic,
    language,
    threadId,
    onProgress
  }: {
    topic: string;
    language: string;
    threadId?: string;
    onProgress?: OnProgress;
  }) {
    const appConfig = getAppConfig();
    const stateId = threadId || randomUUID();

    emitProgress(onProgress, {
      type: "step_start",
      step: "skill_routing",
      message: "正在匹配相关 Skills..."
    });
    const enabledSkills = loadSkills({ enabledOnly: true });
    const relevantSkills = await selectRelevantSkillsWithModel({
      topic,
      language,
      skills: enabledSkills,
      model: this.options.dryRun ? createDryRunModel() : this.options.model
    });
    emitProgress(onProgress, {
      type: "step_complete",
      step: "skill_routing",
      message: `已匹配 ${relevantSkills.length} 个 Skills：${relevantSkills.map((s) => s.name).join(", ")}`,
      data: { skills: relevantSkills.map((s) => s.name) }
    });
    let state: ThreadState = createInitialThreadState({
      topic,
      language,
      threadId: stateId
    });

    const middlewares = buildLeadRuntimeMiddlewares();
    for (const middleware of middlewares) {
      state = mergeState(state, await middleware.beforeRun?.(state));
    }

    const prompt = applyPromptTemplate({
      topic,
      language,
      availableTools: getAvailableTools().map((tool) => tool.name),
      skillsSection: buildSkillsPromptSection(relevantSkills),
      mcpSection: await buildMcpPromptSection()
    });
    state.messages.push(prompt);

    const skillRuntimeResult = await orchestrateSkillRuntime({
      topic,
      language,
      selectedSkills: relevantSkills,
      model: this.options.dryRun ? createDryRunModel() : this.options.model,
      onProgress
    });

    const mcpResources = await resolveMcpResources();
    state.debug = {
      usedSkills: relevantSkills.map((skill) => ({
        name: skill.name,
        description: skill.description
      })),
      invokedSkills: skillRuntimeResult.invokedSkills.map((skill) => ({
        name: skill.name
      })),
      mcpResources: mcpResources.map((resource) => ({
        title: resource.title
      })),
      githubRepo: null
    };
    if (skillRuntimeResult.notes.length) {
      state.messages.push(
        `Skill runtime context:\n${skillRuntimeResult.notes.join("\n\n")}`
      );
      state.notes = skillRuntimeResult.notes.join("\n\n");
      const githubSkillOutput = skillRuntimeResult.invokedSkills.find(
        (skill) => skill.name === "github_deep_research_skill"
      );
      if (githubSkillOutput) {
        const repoMatch = githubSkillOutput.output.match(/Repository:\s+([^/\s]+)\/([^\s]+)/);
        if (repoMatch) {
          state.debug.githubRepo = {
            owner: repoMatch[1],
            repo: repoMatch[2]
          };
        }
      }
    }
    if (mcpResources.length) {
      state.messages.push(
        `MCP context:\n${mcpResources
          .map((resource) => `- ${resource.title}: ${resource.content}`)
          .join("\n")}`
      );
    }

    const searchClient = this.options.dryRun
      ? { invoke: async () => [] }
      : createSearchClient(appConfig.research);

    const graph = buildResearchGraph({
      model: this.options.dryRun ? createDryRunModel() : this.options.model,
      searchClient,
      config: appConfig.research,
      onProgress
    });

    const result = await graph.invoke({
      topic: state.topic,
      language: state.language,
      plan: state.plan,
      queries: state.queries,
      searchResults: state.searchResults,
      sources: state.sources,
      findings: state.findings,
      notes: state.notes,
      needsMore: state.needsMore,
      report: state.report,
      iteration: state.iteration,
      analyzedUrls: state.analyzedUrls
    });

    state = {
      ...state,
      ...result
    };

    const report = normalizeReportContent(
      state.report || "研究流程未产出报告，请检查模型与搜索配置是否正确。",
      state.topic
    );
    const reportPath = `sqlite://research_records/${stateId}`;
    state.report = report;

    for (const middleware of middlewares) {
      state = mergeState(state, await middleware.afterRun?.(state));
    }

    // 将研究报告与元数据写入 SQLite
    upsertRecord({
      threadId: stateId,
      title: state.title || topic.slice(0, 80),
      topic,
      reportPath,
      reportContent: report,
      sources: state.sources.length,
      iterations: state.iteration,
      findingsJson: JSON.stringify(state.findings || []),
      sourcesJson: JSON.stringify(state.sources || []),
      createdAt: Date.now()
    });

    return {
      state,
      reportPath,
      stats: {
        sources: state.sources.length,
        iterations: state.iteration
      }
    };
  }
}
