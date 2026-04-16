# Deep Research Backend

This backend refactors the original flat JavaScript research flow into a DeerFlow-style TypeScript architecture.

## Structure

```text
src/
├── app/gateway/                      # HTTP gateway entry and routers
├── packages/harness/deepresearch/
│   ├── agents/                       # Lead agent, thread state, middlewares
│   ├── config/                       # App config and thread paths
│   ├── models/                       # Model factory
│   ├── research/                     # Research graph, prompts, search, fetch, output
│   ├── tools/                        # Built-in tool registry
│   └── utils/                        # Shared helpers
├── cli.ts                            # CLI entry
└── index.ts                          # Public backend entry
```

## Main Mapping From DeerFlow

- `app/gateway/*` mirrors DeerFlow's gateway layer.
- `packages/harness/deepresearch/agents/*` mirrors the lead-agent runtime layout.
- `packages/harness/deepresearch/config/*` mirrors centralized config loading.
- `packages/harness/deepresearch/skills/*` adds DeerFlow-style skill loading and prompt injection.
- `packages/harness/deepresearch/mcp/*` adds a simplified MCP configuration and resource resolution layer.
- `packages/harness/deepresearch/tools/*` mirrors the tool registry and built-ins.
- `packages/harness/deepresearch/research/*` contains the original deep-research execution logic, now placed under the harness architecture.

## Scripts

- `npm run start` runs the CLI entry.
- `npm run gateway` starts the HTTP gateway.
- `npm run verify` performs a lightweight import check.

## API

- `GET /api/models`
- `GET /api/skills`
- `PUT /api/skills/:skillName`
- `GET /api/mcp/config`
- `PUT /api/mcp/config`
- `POST /api/research`
