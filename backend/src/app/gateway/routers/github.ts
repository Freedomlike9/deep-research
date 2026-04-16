import { buildGitHubResearchContext } from "../../../packages/harness/deepresearch/skills/runtime/github-deep-research.ts";

export const getGitHubContextRoute = async (payload: { topic?: string }) => {
  if (!payload.topic) {
    throw new Error("topic is required");
  }
  const context = await buildGitHubResearchContext(payload.topic);
  if (!context) {
    throw new Error("No GitHub repository detected in topic");
  }
  return context;
};
