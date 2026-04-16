import type { ThreadState } from "../thread-state.ts";

export interface AgentMiddleware {
  name: string;
  beforeRun?(state: ThreadState): Promise<Partial<ThreadState> | void>;
  afterRun?(state: ThreadState): Promise<Partial<ThreadState> | void>;
}
