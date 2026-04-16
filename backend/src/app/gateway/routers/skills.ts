import { loadSkills } from "../../../packages/harness/deepresearch/skills/loader.ts";
import { loadExtensionsConfig, saveExtensionsConfig } from "../../../packages/harness/deepresearch/config/extensions-config.ts";

export const listSkills = async () => ({
  skills: loadSkills({ enabledOnly: false }).map((skill) => ({
    name: skill.name,
    description: skill.description,
    category: skill.category,
    enabled: skill.enabled
  }))
});

export const updateSkill = async (skillName: string, enabled: boolean) => {
  const config = loadExtensionsConfig();
  const existing = loadSkills({ enabledOnly: false }).find((item) => item.name === skillName);
  if (!existing) {
    throw new Error(`Skill '${skillName}' not found`);
  }
  config.skills[skillName] = { enabled };
  saveExtensionsConfig(config);
  return {
    skill: loadSkills({ enabledOnly: false }).find((item) => item.name === skillName) || null
  };
};
