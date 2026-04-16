import { buildThreadPaths } from "../../config/paths.ts";
import { ensureDir } from "../../utils/fs.ts";
import type { AgentMiddleware } from "./base.ts";

export class ThreadDataMiddleware implements AgentMiddleware {
  name = "ThreadDataMiddleware";

  async beforeRun(state: { threadId: string }) {
    const threadData = buildThreadPaths(state.threadId);
    await Promise.all([
      ensureDir(threadData.workspacePath),
      ensureDir(threadData.uploadsPath),
      ensureDir(threadData.outputsPath)
    ]);
    return {
      threadData: {
        workspacePath: threadData.workspacePath,
        uploadsPath: threadData.uploadsPath,
        outputsPath: threadData.outputsPath
      }
    };
  }
}
