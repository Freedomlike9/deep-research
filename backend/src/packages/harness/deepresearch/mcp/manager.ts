import { loadExtensionsConfig, type McpInlineResource, type McpServerConfig } from "../config/extensions-config.ts";

export interface McpServerDescriptor extends McpServerConfig {
  name: string;
}

export const listMcpServers = (): McpServerDescriptor[] =>
  Object.entries(loadExtensionsConfig().mcpServers).map(([name, config]) => ({
    name,
    ...config
  }));

const fetchHttpResources = async (server: McpServerDescriptor): Promise<McpInlineResource[]> => {
  if (!server.url) {
    return [];
  }
  try {
    const response = await fetch(server.url, {
      headers: server.headers
    });
    const payload = (await response.json()) as { resources?: McpInlineResource[] };
    return payload.resources || [];
  } catch {
    return [];
  }
};

export const resolveMcpResources = async (): Promise<McpInlineResource[]> => {
  const servers = listMcpServers().filter((server) => server.enabled);
  const resolved = await Promise.all(
    servers.map(async (server) => {
      if (server.type === "inline") {
        return server.resources || [];
      }
      return fetchHttpResources(server);
    })
  );
  return resolved.flat();
};

export const buildMcpPromptSection = async () => {
  const servers = listMcpServers().filter((server) => server.enabled);
  const resources = await resolveMcpResources();
  const serverLines = servers
    .map((server) => `- ${server.name}: ${server.description}`)
    .join("\n");
  const resourceLines = resources
    .map((resource) => `### ${resource.title}\n${resource.content}`)
    .join("\n\n");

  if (!serverLines && !resourceLines) {
    return "";
  }

  return `
<mcp>
Enabled Servers:
${serverLines || "- none"}

Resolved Resources:
${resourceLines || "No inline MCP resources available."}
</mcp>
`;
};
