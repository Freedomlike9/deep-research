import type { AgentMiddleware } from "./base.ts";

export class TitleMiddleware implements AgentMiddleware {
  name = "TitleMiddleware";

  async afterRun(state: { title?: string; topic: string }) {
    if (state.title) {
      return;
    }
    return {
      title: state.topic.slice(0, 80)
    };
  }
}
