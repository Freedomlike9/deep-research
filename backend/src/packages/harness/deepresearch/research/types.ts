export type SourceFetchStatus = "raw" | "fetched" | "failed" | "skipped";

export interface ResearchSourceScore {
  authority: number;
  relevance: number;
  completeness: number;
  total: number;
}

export interface ResearchSource {
  id: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  content?: string;
  query?: string;
  fetchStatus: SourceFetchStatus;
  contentType?: string;
  finalUrl?: string;
  extractionMethod?: "snippet" | "html";
  fetchedAt?: number;
  score: ResearchSourceScore;
}

export interface ResearchFindingEvidence {
  sourceId: string;
  title: string;
  url: string;
  summary: string;
}

export interface ResearchFinding {
  claim: string;
  confidence: "low" | "medium" | "high";
  evidence: ResearchFindingEvidence[];
  missingEvidence?: string[];
}

export interface ResearchAnalysis {
  summary: string;
  findings: ResearchFinding[];
  openQuestions: string[];
}

export interface QualityCheckResult {
  needsMore: boolean;
  newQueries: string[];
  uncoveredAngles: string[];
  weakClaims: string[];
}
