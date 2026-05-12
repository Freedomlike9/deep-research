export interface ThreadDataState {
  workspacePath?: string;
  uploadsPath?: string;
  outputsPath?: string;
}

import type { ResearchFinding, ResearchSource, ResearchQueryPlan } from "../research/types.ts";

export interface ThreadState {
  threadId: string;
  topic: string;
  language: string;
  messages: string[];
  title?: string;
  artifacts: string[];
  debug?: {
    usedSkills: Array<{ name: string; description: string }>;
    invokedSkills?: Array<{ name: string }>;
    mcpResources: Array<{ title: string }>;
    githubRepo?: { owner: string; repo: string } | null;
  };
  threadData?: ThreadDataState;
  plan?: ResearchQueryPlan | null;
  queries: string[];
  searchResults: Array<{
    query: string;
    results: ResearchSource[];
  }>;
  sources: ResearchSource[];
  findings: ResearchFinding[];
  notes: string;
  needsMore: boolean;
  report: string;
  iteration: number;
  analyzedUrls: string[];
}

export const createInitialThreadState = ({
  topic,
  language,
  threadId
}: {
  topic: string;
  language: string;
  threadId: string;
}): ThreadState => ({
  threadId,
  topic,
  language,
  messages: [],
  artifacts: [],
  debug: {
    usedSkills: [],
    invokedSkills: [],
    mcpResources: [],
    githubRepo: null
  },
  queries: [],
  searchResults: [],
  sources: [],
  findings: [],
  notes: "",
  needsMore: false,
  report: "",
  iteration: 0,
  analyzedUrls: [],
  plan: null
});
