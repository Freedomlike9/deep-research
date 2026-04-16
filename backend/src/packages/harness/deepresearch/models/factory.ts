import { RunnableLambda } from "@langchain/core/runnables";
import type { AIMessageChunk } from "@langchain/core/messages";
import type { Runnable } from "@langchain/core/runnables";
import type { BindToolsInput } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { getModelConfig } from "../config/app-config.ts";

export interface TextGenerationModel {
  invoke(input: unknown): Promise<{ content: string | unknown }>;
  stream?(input: string): Promise<AsyncIterable<unknown>> | AsyncIterable<unknown>;
  bindTools?(
    tools: BindToolsInput[],
    kwargs?: Record<string, unknown>
  ): Runnable<unknown, AIMessageChunk>;
}

export const createChatModel = (name?: string) => {
  const config = getModelConfig(name);
  if (!config.apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }
  return new ChatOpenAI({
    model: config.model,
    temperature: config.temperature ?? 0.2,
    topP: config.topP,
    apiKey: config.apiKey,
    configuration: process.env.OPENAI_BASE_URL
      ? {
          baseURL: process.env.OPENAI_BASE_URL
        }
      : undefined
  }) as TextGenerationModel;
};

export const createDryRunModel = () =>
  new RunnableLambda({
    func: async (input) => {
      const text = typeof input === "string" ? input : JSON.stringify(input);
      if (text.includes("needsMore")) {
        return { content: JSON.stringify({ needsMore: false, newQueries: [] }) };
      }
      if (text.includes("queries")) {
        return {
          content: JSON.stringify({
            angles: ["概念概览", "关键应用", "挑战与风险", "趋势与未来"],
            queries: ["主题概览", "核心应用 案例", "挑战 风险", "趋势 2026"]
          })
        };
      }
      return { content: "干运行模式：未执行真实模型调用。" };
    }
  }) as TextGenerationModel;
