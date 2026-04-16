import { getAppConfig } from "../config/app-config.ts";
import { askClarificationTool } from "./builtins/ask-clarification-tool.ts";
import { presentFileTool } from "./builtins/present-file-tool.ts";

export const getAvailableTools = () => {
  const config = getAppConfig();
  return [
    ...config.tools,
    askClarificationTool,
    presentFileTool
  ];
};
