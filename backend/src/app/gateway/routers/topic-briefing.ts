import { runTopicBriefing } from "../../../packages/harness/deepresearch/skills/runtime/topic-briefing.ts";

export const runTopicBriefingRoute = async (payload: {
  topic?: string;
  audience?: string;
  language?: string;
}) => {
  if (!payload.topic?.trim()) {
    throw new Error("topic is required");
  }

  return runTopicBriefing({
    topic: payload.topic.trim(),
    audience: payload.audience?.trim(),
    language: payload.language?.trim()
  });
};
