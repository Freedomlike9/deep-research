import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export const backendRoot = path.resolve(dirname, "../../../../..");
export const threadRoot = path.join(backendRoot, ".deep-research", "threads");

export const buildThreadPaths = (threadId: string) => {
  const userDataRoot = path.join(threadRoot, threadId, "user-data");
  return {
    root: path.join(threadRoot, threadId),
    userDataRoot,
    workspacePath: path.join(userDataRoot, "workspace"),
    uploadsPath: path.join(userDataRoot, "uploads"),
    outputsPath: path.join(userDataRoot, "outputs")
  };
};
