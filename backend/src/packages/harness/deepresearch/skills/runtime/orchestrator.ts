import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";
import type { TextGenerationModel } from "../../models/factory.ts";
import type { OnProgress } from "../../research/progress.ts";
import { emitProgress } from "../../research/progress.ts";
import type { Skill } from "../types.ts";
import { selectRelevantSkills } from "../loader.ts";
import { buildGitHubResearchContext } from "./github-deep-research.ts";
import { runTopicBriefing } from "./topic-briefing.ts";

interface SkillRuntimeContext {
  topic: string;
  language: string;
  onProgress?: OnProgress;
}

export interface SkillOrchestrationResult {
  selectedSkills: Skill[];
  invokedSkills: Array<{ name: string; output: string }>;
  notes: string[];
}

const stringifyContent = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stringifyContent(item)).join("");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") {
      return record.text;
    }
    if (record.content !== undefined) {
      return stringifyContent(record.content);
    }
  }
  return "";
};

const buildSkillSelectionPrompt = (topic: string, language: string, skills: Skill[]) => `
You are selecting skills for a deep research agent.

Choose the most relevant skills for the topic below.
Return JSON only with this schema:
{"skills": string[]}

Rules:
- Select 1 to 4 skills.
- Only select names from the provided catalog.
- Prefer skills that materially improve the research quality.
- Include "deep-research" when it is relevant.
- Do not invent skill names.

Topic: ${topic}
Language: ${language}

Catalog:
${skills.map((skill) => `- ${skill.name}: ${skill.description}`).join("\n")}
`.trim();

const parseSelectedSkillNames = (raw: string): string[] => {
  const candidate = raw.trim();
  if (!candidate) {
    return [];
  }

  const parseJson = (value: string) => {
    const parsed = JSON.parse(value) as { skills?: unknown };
    if (!Array.isArray(parsed.skills)) {
      return [];
    }
    return parsed.skills
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  };

  try {
    return parseJson(candidate);
  } catch {
    const match = candidate.match(/\{[\s\S]*\}/);
    if (!match) {
      return [];
    }
    try {
      return parseJson(match[0]);
    } catch {
      return [];
    }
  }
};

const createTopicBriefingTool = ({ topic, language, onProgress }: SkillRuntimeContext) =>
  tool(
    async ({
      audience,
      focus
    }: {
      audience?: string;
      focus?: string;
    }) => {
      emitProgress(onProgress, {
        type: "step_start",
        step: "skill_routing",
        message: "正在执行 skill：topic-briefing"
      });
      const { brief, error } = await runTopicBriefing({
        topic: focus ? `${topic}\n补充关注点：${focus}` : topic,
        audience,
        language
      });
      emitProgress(onProgress, {
        type: "step_complete",
        step: "skill_routing",
        message: "skill 执行完成：topic-briefing"
      });
      return error ? `${brief}\n\n[stderr]\n${error}` : brief;
    },
    {
      name: "topic_briefing_skill",
      description: "Generate a structured kickoff brief for the current research topic before deeper investigation.",
      schema: z.object({
        audience: z.string().optional().describe("Optional audience for the brief, such as executive team or engineers."),
        focus: z.string().optional().describe("Optional extra angle or focus area to emphasize in the brief.")
      })
    }
  );

const createGithubContextTool = ({ topic, onProgress }: SkillRuntimeContext) =>
  tool(
    async ({ repoHint }: { repoHint?: string }) => {
      emitProgress(onProgress, {
        type: "step_start",
        step: "skill_routing",
        message: "正在执行 skill：github-deep-research"
      });
      const context = await buildGitHubResearchContext(repoHint || topic);
      emitProgress(onProgress, {
        type: "step_complete",
        step: "skill_routing",
        message: context ? "skill 执行完成：github-deep-research" : "未识别到可用的 GitHub 仓库上下文"
      });
      if (!context) {
        return "No GitHub repository context was detected for this topic.";
      }
      return [
        `Repository: ${context.repo.owner}/${context.repo.repo}`,
        "",
        "Summary:",
        context.summary,
        "",
        "Repository Tree:",
        context.tree,
        "",
        "README Excerpt:",
        context.readme.slice(0, 3000),
        context.template ? `\nPreferred Report Template:\n${context.template.slice(0, 2000)}` : ""
      ]
        .filter(Boolean)
        .join("\n");
    },
    {
      name: "github_deep_research_skill",
      description: "Fetch repository-level GitHub context including summary, tree, README excerpt, and template guidance.",
      schema: z.object({
        repoHint: z.string().optional().describe("Optional repo URL or owner/repo hint if the topic contains multiple repositories.")
      })
    }
  );

const buildRuntimeTools = (skills: Skill[], context: SkillRuntimeContext): StructuredToolInterface[] => {
  const tools: StructuredToolInterface[] = [];

  for (const skill of skills) {
    if (skill.name === "topic-briefing") {
      tools.push(createTopicBriefingTool(context));
    }
    if (skill.name === "github-deep-research") {
      tools.push(createGithubContextTool(context));
    }
  }

  return tools;
};

const buildToolPrompt = ({
  topic,
  language,
  skills
}: {
  topic: string;
  language: string;
  skills: Skill[];
}) => `
You are the skill orchestration layer for a deep research agent.

Your job:
1. Review the selected skills and the user topic.
2. Decide whether any skill runtime tools should be invoked before the main research graph starts.
3. Call a tool only when it will add concrete value.
4. After tool execution, provide a short plain-text summary of what was gained for downstream research.

Constraints:
- You may call zero, one, or multiple tools.
- Avoid redundant calls.
- Keep the final assistant summary concise.

Topic: ${topic}
Language: ${language}

Selected skills:
${skills
  .map(
    (skill) => `## ${skill.name}
Description: ${skill.description}
Instructions:
${skill.content}`
  )
  .join("\n\n")}
`.trim();

export const selectRelevantSkillsWithModel = async ({
  topic,
  language,
  skills,
  model
}: {
  topic: string;
  language: string;
  skills: Skill[];
  model: TextGenerationModel;
}) => {
  if (!skills.length) {
    return [];
  }

  const response = await model.invoke(buildSkillSelectionPrompt(topic, language, skills));
  const names = new Set(parseSelectedSkillNames(stringifyContent(response.content)));
  const selected = skills.filter((skill) => names.has(skill.name));
  return selected.length ? selected : selectRelevantSkills({ topic, skills });
};

export const orchestrateSkillRuntime = async ({
  topic,
  language,
  selectedSkills,
  model,
  onProgress
}: {
  topic: string;
  language: string;
  selectedSkills: Skill[];
  model: TextGenerationModel;
  onProgress?: OnProgress;
}): Promise<SkillOrchestrationResult> => {
  const runtimeTools = buildRuntimeTools(selectedSkills, { topic, language, onProgress });
  if (!runtimeTools.length || typeof model.bindTools !== "function") {
    return {
      selectedSkills,
      invokedSkills: [],
      notes: []
    };
  }

  const llmWithTools = model.bindTools(runtimeTools, {
    tool_choice: "auto",
    parallel_tool_calls: false
  });

  const messages: Array<SystemMessage | HumanMessage | AIMessage | ToolMessage> = [
    new SystemMessage(buildToolPrompt({ topic, language, skills: selectedSkills })),
    new HumanMessage(`Please prepare any useful skill runtime context for this research topic: ${topic}`)
  ];

  const toolByName = new Map(runtimeTools.map((toolInstance) => [toolInstance.name, toolInstance]));
  const invokedSkills: Array<{ name: string; output: string }> = [];
  let summary = "";

  for (let round = 0; round < 4; round += 1) {
    const response = await llmWithTools.invoke(messages);
    const aiMessage = new AIMessage({
      content: stringifyContent(response.content),
      tool_calls: response.tool_calls,
      additional_kwargs: response.additional_kwargs
    });
    messages.push(aiMessage);

    if (!response.tool_calls?.length) {
      summary = stringifyContent(response.content).trim();
      break;
    }

    for (const toolCall of response.tool_calls) {
      const toolInstance = toolByName.get(toolCall.name);
      if (!toolInstance) {
        continue;
      }
      const toolOutput = await toolInstance.invoke(toolCall.args ?? {});
      const normalizedOutput =
        typeof toolOutput === "string" ? toolOutput : stringifyContent((toolOutput as { content?: unknown }).content);
      invokedSkills.push({
        name: toolCall.name,
        output: normalizedOutput
      });
      messages.push(
        new ToolMessage({
          tool_call_id: toolCall.id ?? toolCall.name,
          content: normalizedOutput
        })
      );
    }
  }

  const notes = invokedSkills.map(
    (entry) => `## ${entry.name}\n${entry.output}`
  );
  if (summary) {
    notes.push(`## skill_orchestration_summary\n${summary}`);
  }

  return {
    selectedSkills,
    invokedSkills,
    notes
  };
};
