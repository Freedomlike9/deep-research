import fs from "node:fs";
import path from "node:path";
import { backendRoot } from "../config/paths.ts";
import { loadExtensionsConfig } from "../config/extensions-config.ts";
import { parseSkillFile } from "./parser.ts";
import type { Skill } from "./types.ts";

const skillsRoot = path.resolve(backendRoot, "../skills");

const walk = (dirPath: string): string[] => {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && entry.name === "SKILL.md") {
      files.push(fullPath);
    }
  }
  return files;
};

export const loadSkills = ({ enabledOnly = false }: { enabledOnly?: boolean } = {}): Skill[] => {
  const extensions = loadExtensionsConfig();
  const skills: Skill[] = [];

  for (const category of ["public", "custom"] as const) {
    const categoryPath = path.join(skillsRoot, category);
    for (const filePath of walk(categoryPath)) {
      const skill = parseSkillFile({
        filePath,
        category,
        enabled: extensions.skills[path.basename(path.dirname(filePath))]?.enabled ?? true
      });
      if (skill) {
        skills.push(skill);
      }
    }
  }

  const filtered = enabledOnly ? skills.filter((skill) => skill.enabled) : skills;
  return filtered.sort((left, right) => left.name.localeCompare(right.name));
};

export const selectRelevantSkills = ({
  topic,
  skills
}: {
  topic: string;
  skills: Skill[];
}) => {
  const normalizedTopic = topic.toLowerCase();
  const selected = skills.filter((skill) => {
    const normalizedName = skill.name.toLowerCase();

    if (normalizedTopic.includes(normalizedName)) {
      return true;
    }
    if (skill.name === "github-deep-research" && /(github|repo|repository|开源|源码)/i.test(normalizedTopic)) {
      return true;
    }
    if (skill.name === "consulting-analysis" && /(分析|报告|research|market|industry|competitive|strategy|架构)/i.test(normalizedTopic)) {
      return true;
    }
    if (skill.name === "data-analysis" && /(csv|excel|xlsx|dataset|data|表格|数据)/i.test(normalizedTopic)) {
      return true;
    }
    if (skill.name === "find-skills" && /(skill|能力|扩展|插件|workflow)/i.test(normalizedTopic)) {
      return true;
    }
    if (skill.name === "topic-briefing" && /(brief|kickoff|outline|提纲|梳理|简报|启动|方向)/i.test(normalizedTopic)) {
      return true;
    }
    if (skill.name === "deep-research" && /(research|研究|分析|总结|overview|架构)/i.test(normalizedTopic)) {
      return true;
    }
    return false;
  });

  return selected.length ? selected : skills.filter((skill) => skill.name === "deep-research");
};

export const buildSkillsPromptSection = (skills: Skill[]) => {
  if (!skills.length) {
    return "";
  }
  return `
<skills>
${skills
  .map(
    (skill) => `## ${skill.name}
Description: ${skill.description}
Instructions:
${skill.content}`
  )
  .join("\n\n")}
</skills>
`;
};
