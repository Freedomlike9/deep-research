import type { AgentMiddleware } from "./base.ts";
import { ThreadDataMiddleware } from "./thread-data-middleware.ts";
import { TitleMiddleware } from "./title-middleware.ts";

export const buildLeadRuntimeMiddlewares = (): AgentMiddleware[] => [
  new ThreadDataMiddleware(),
  new TitleMiddleware()
];
