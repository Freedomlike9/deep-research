# Deep Research 后端

该后端将原本扁平的 JavaScript 研究流程重构为 DeerFlow 风格的 TypeScript 架构。

## 结构

```text
src/
├── app/gateway/                      # HTTP 网关入口与路由
├── packages/harness/deepresearch/
│   ├── agents/                       # 主智能体、线程状态、中间件
│   ├── config/                       # 应用配置与线程路径
│   ├── models/                       # 模型工厂
│   ├── research/                     # 研究图、提示词、搜索、抓取、输出
│   ├── tools/                        # 内置工具注册表
│   └── utils/                        # 通用辅助函数
├── cli.ts                            # CLI 入口
└── index.ts                          # 后端对外入口
```

## 与 DeerFlow 的主要映射

- `app/gateway/*` 对应 DeerFlow 的网关层。
- `packages/harness/deepresearch/agents/*` 对应主智能体运行时布局。
- `packages/harness/deepresearch/config/*` 对应集中式配置加载。
- `packages/harness/deepresearch/skills/*` 增加 DeerFlow 风格技能加载与提示注入。
- `packages/harness/deepresearch/mcp/*` 增加简化版 MCP 配置与资源解析层。
- `packages/harness/deepresearch/tools/*` 对应工具注册与内置工具。
- `packages/harness/deepresearch/research/*` 包含原 deep-research 执行逻辑，并迁移到 harness 架构下。

## 脚本

- `npm run start` 运行 CLI 入口。
- `npm run gateway` 启动 HTTP 网关。
- `npm run verify` 执行轻量级导入检查。

## API

- `GET /api/models`
- `GET /api/skills`
- `PUT /api/skills/:skillName`
- `GET /api/mcp/config`
- `PUT /api/mcp/config`
- `POST /api/research`
