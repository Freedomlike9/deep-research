import fs from "node:fs";
import type { Skill } from "./types.ts";

const parseFrontmatter = (raw: string) => {
  if (!raw.startsWith("---")) {
    return { metadata: {}, body: raw };
  }
  const end = raw.indexOf("\n---", 3);
  if (end === -1) {
    return { metadata: {}, body: raw };
  }

  const frontmatter = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  const metadata: Record<string, string> = {};

  for (const line of frontmatter.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    metadata[key] = value;
  }

  return { metadata, body };
};

export const parseSkillFile = ({
  filePath,
  category,
  enabled
}: {
  filePath: string;
  category: "public" | "custom";
  enabled: boolean;
}): Skill | null => {
  const raw = fs.readFileSync(filePath, "utf8");
  const { metadata, body } = parseFrontmatter(raw);
  if (!metadata.name || !metadata.description) {
    return null;
  }
  return {
    name: metadata.name,
    description: metadata.description,
    content: body,
    category,
    enabled,
    path: filePath
  };
};
