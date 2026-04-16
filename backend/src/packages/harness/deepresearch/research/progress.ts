export type ProgressEventType =
  | "step_start"
  | "step_complete"
  | "search_result"
  | "source_fetched"
  | "iteration"
  | "report_chunk"
  | "done"
  | "error";

export type ResearchStep =
  | "skill_routing"
  | "plan"
  | "search"
  | "fetch"
  | "analyze"
  | "quality"
  | "report";

export interface ProgressEvent {
  type: ProgressEventType;
  step?: ResearchStep;
  message: string;
  data?: unknown;
  progress?: {
    current: number;
    total: number;
  };
  timestamp: number;
}

export type OnProgress = (event: ProgressEvent) => void;

export const emitProgress = (
  onProgress: OnProgress | undefined,
  event: Omit<ProgressEvent, "timestamp">
) => {
  onProgress?.({ ...event, timestamp: Date.now() });
};
