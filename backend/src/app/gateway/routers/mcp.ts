import { loadExtensionsConfig, saveExtensionsConfig, type ExtensionsConfig } from "../../../packages/harness/deepresearch/config/extensions-config.ts";

export const getMcpConfiguration = async () => {
  const config = loadExtensionsConfig();
  return {
    mcpServers: config.mcpServers
  };
};

export const updateMcpConfiguration = async (mcpServers: ExtensionsConfig["mcpServers"]) => {
  const config = loadExtensionsConfig();
  config.mcpServers = mcpServers;
  saveExtensionsConfig(config);
  return {
    mcpServers: config.mcpServers
  };
};
