import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { backendRoot } from "../../config/paths.ts";

const execFileAsync = promisify(execFile);
const topicBriefingScriptPath = path.resolve(
  backendRoot,
  "../skills/public/topic-briefing/scripts/generate_brief.js"
);
const topicBriefingTemplatePath = path.resolve(
  backendRoot,
  "../skills/public/topic-briefing/assets/output-template.md"
);

export interface TopicBriefingInput {
  topic: string;
  audience?: string;
  language?: string;
}

export const runTopicBriefing = async ({
  topic,
  audience,
  language
}: TopicBriefingInput) => {
  const args = [topicBriefingScriptPath, "--topic", topic, "--template", topicBriefingTemplatePath];
  if (audience) {
    args.push("--audience", audience);
  }
  if (language) {
    args.push("--language", language);
  }

  const { stdout, stderr } = await execFileAsync("node", args, {
    env: process.env
  });

  return {
    brief: stdout.trim(),
    error: stderr.trim()
  };
};
