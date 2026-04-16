import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { backendRoot } from "../../config/paths.ts";

const execFileAsync = promisify(execFile);

const githubSkillRoot = path.resolve(backendRoot, "../skills/public/github-deep-research");
const githubScriptPath = path.join(githubSkillRoot, "scripts", "github_api.py");
const githubTemplatePath = path.join(githubSkillRoot, "assets", "report_template.md");

export interface GitHubRepoMatch {
  owner: string;
  repo: string;
}

export const parseGitHubRepo = (topic: string): GitHubRepoMatch | null => {
  const urlMatch = topic.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2].replace(/\.git$/i, "")
    };
  }

  const shorthandMatch = topic.match(/\b([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\b/);
  if (shorthandMatch && !topic.includes("http")) {
    return {
      owner: shorthandMatch[1],
      repo: shorthandMatch[2].replace(/\.git$/i, "")
    };
  }

  return null;
};

const runGithubScript = async ({
  owner,
  repo,
  command
}: {
  owner: string;
  repo: string;
  command: "summary" | "readme" | "tree";
}) => {
  const { stdout } = await execFileAsync("python3", [githubScriptPath, owner, repo, command], {
    env: process.env
  });
  return stdout.trim();
};

export const loadGithubReportTemplate = async () => {
  try {
    return await fs.readFile(githubTemplatePath, "utf8");
  } catch {
    return "";
  }
};

export const buildGitHubResearchContext = async (topic: string) => {
  const repo = parseGitHubRepo(topic);
  if (!repo) {
    return null;
  }

  const [summary, readme, tree, template] = await Promise.all([
    runGithubScript({ ...repo, command: "summary" }),
    runGithubScript({ ...repo, command: "readme" }),
    runGithubScript({ ...repo, command: "tree" }),
    loadGithubReportTemplate()
  ]);

  return {
    repo,
    summary,
    readme,
    tree,
    template
  };
};
