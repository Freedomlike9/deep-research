import fs from "node:fs/promises";

export const ensureDir = async (targetPath: string) => {
  await fs.mkdir(targetPath, { recursive: true });
};

export const safeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "report";
