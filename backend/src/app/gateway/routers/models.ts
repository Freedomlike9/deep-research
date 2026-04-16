import { getAppConfig } from "../../../packages/harness/deepresearch/config/app-config.ts";

export const listModels = async () => {
  const config = getAppConfig();
  return {
    models: config.models.map((model) => ({
      name: model.name,
      model: model.model,
      displayName: model.displayName,
      description: model.description,
      supportsThinking: Boolean(model.supportsThinking),
      supportsVision: Boolean(model.supportsVision)
    }))
  };
};
