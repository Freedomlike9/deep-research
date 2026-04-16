import http from "node:http";
import { runDataAnalysisRoute } from "./routers/data-analysis.ts";
import { getGitHubContextRoute } from "./routers/github.ts";
import { getMcpConfiguration, updateMcpConfiguration } from "./routers/mcp.ts";
import { listModels } from "./routers/models.ts";
import { getLatestResearchRoute, runResearchRoute, runResearchStreamRoute } from "./routers/research.ts";
import { listSkills, updateSkill } from "./routers/skills.ts";
import { runTopicBriefingRoute } from "./routers/topic-briefing.ts";

const readJsonBody = async <T>(request: http.IncomingMessage): Promise<T> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? (JSON.parse(raw) as T) : ({} as T));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });

const json = (reply: http.ServerResponse, statusCode: number, payload: unknown) => {
  reply.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  reply.end(JSON.stringify(payload, null, 2));
};

export const createGatewayServer = () =>
  http.createServer(async (request, reply) => {
    try {
      if (!request.url || !request.method) {
        json(reply, 400, { error: "Invalid request" });
        return;
      }

      if (request.method === "OPTIONS") {
        json(reply, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && request.url === "/health") {
        json(reply, 200, { status: "healthy", service: "deep-research-gateway" });
        return;
      }

      if (request.method === "GET" && request.url === "/api/models") {
        json(reply, 200, await listModels());
        return;
      }

      if (request.method === "GET" && request.url === "/api/research/latest") {
        json(reply, 200, await getLatestResearchRoute());
        return;
      }

      // SSE streaming research endpoint
      if (request.method === "POST" && request.url === "/api/research/stream") {
        const payload = await readJsonBody<{ topic?: string; language?: string; dryRun?: boolean }>(request);
        await runResearchStreamRoute(payload, reply);
        return;
      }

      if (request.method === "POST" && request.url === "/api/github/context") {
        const payload = await readJsonBody<{ topic?: string }>(request);
        json(reply, 200, await getGitHubContextRoute(payload));
        return;
      }

      if (request.method === "POST" && request.url === "/api/data-analysis") {
        const payload = await readJsonBody<{
          files?: string[];
          action?: "inspect" | "query" | "summary";
          sql?: string;
          table?: string;
          outputFile?: string;
        }>(request);
        json(reply, 200, await runDataAnalysisRoute(payload));
        return;
      }

      if (request.method === "POST" && request.url === "/api/topic-briefing") {
        const payload = await readJsonBody<{
          topic?: string;
          audience?: string;
          language?: string;
        }>(request);
        json(reply, 200, await runTopicBriefingRoute(payload));
        return;
      }

      if (request.method === "GET" && request.url === "/api/skills") {
        json(reply, 200, await listSkills());
        return;
      }

      if (request.method === "PUT" && request.url.startsWith("/api/skills/")) {
        const skillName = decodeURIComponent(request.url.slice("/api/skills/".length));
        const payload = await readJsonBody<{ enabled: boolean }>(request);
        json(reply, 200, await updateSkill(skillName, Boolean(payload.enabled)));
        return;
      }

      if (request.method === "GET" && request.url === "/api/mcp/config") {
        json(reply, 200, await getMcpConfiguration());
        return;
      }

      if (request.method === "PUT" && request.url === "/api/mcp/config") {
        const payload = await readJsonBody<{ mcpServers: Record<string, unknown> }>(request);
        json(
          reply,
          200,
          await updateMcpConfiguration(payload.mcpServers as Awaited<ReturnType<typeof getMcpConfiguration>>["mcpServers"])
        );
        return;
      }

      if (request.method === "POST" && request.url === "/api/research") {
        const payload = await readJsonBody<{ topic?: string; language?: string; dryRun?: boolean }>(request);
        json(reply, 200, await runResearchRoute(payload));
        return;
      }

      json(reply, 404, { error: "Not found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      json(reply, 500, { error: message });
    }
  });

if (process.argv[1]?.endsWith("/app.ts")) {
  const port = Number.parseInt(process.env.PORT || "8001", 10);
  const host = process.env.HOST || "127.0.0.1";
  createGatewayServer().listen(port, host, () => {
    process.stdout.write(`Deep Research gateway listening on ${host}:${port}\n`);
  });
}
