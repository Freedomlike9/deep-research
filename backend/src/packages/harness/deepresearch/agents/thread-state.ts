export interface ThreadDataState {
  workspacePath?: string;
  uploadsPath?: string;
  outputsPath?: string;
}

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
  plan?: {
    angles: string[];
    queries: string[];
  } | null;
  queries: string[];
  searchResults: Array<{
    query: string;
    results: Array<{
      title: string;
      url: string;
      snippet: string;
      content?: string;
      query?: string;
    }>;
  }>;
  sources: Array<{
    title: string;
    url: string;
    snippet: string;
    content?: string;
  }>;
  notes: string;
  needsMore: boolean;
  report: string;
  iteration: number;
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
  notes: "",
  needsMore: false,
  report: "",
  iteration: 0,
  plan: null
});
