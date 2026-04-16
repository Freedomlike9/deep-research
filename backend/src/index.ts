import { LeadResearchAgent } from "./packages/harness/deepresearch/agents/lead-agent/agent.ts";
import { getAppConfig } from "./packages/harness/deepresearch/config/app-config.ts";
import { createChatModel, createDryRunModel } from "./packages/harness/deepresearch/models/factory.ts";

export interface RunDeepResearchInput {
  topic: string;
  outputDir?: string;
  language?: string;
  dryRun?: boolean;
}

export const runDeepResearch = async ({
  topic,
  outputDir,
  language,
  dryRun = false
}: RunDeepResearchInput) => {
  if (!topic) {
    throw new Error("Topic is required");
  }

  const appConfig = getAppConfig();
  if (outputDir) {
    appConfig.outputDir = outputDir;
  }
  if (language) {
    appConfig.research.outputLanguage = language;
  }

  const agent = new LeadResearchAgent({
    model: dryRun ? createDryRunModel() : createChatModel(),
    dryRun
  });

  const result = await agent.invoke({
    topic,
    language: appConfig.research.outputLanguage
  });

  return {
    reportPath: result.reportPath,
    report: result.state.report,
    stats: result.stats,
    title: result.state.title
  };
};
