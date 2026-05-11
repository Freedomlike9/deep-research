---
name: query-planner
description: Generate high-coverage research queries across multiple intents before search begins. Use when the topic is broad, ambiguous, strategic, technical, or likely to require more than one search angle.
---

# Query Planner

Use this skill to turn a raw research topic into a deliberate search plan before large-scale retrieval begins.

## When To Use

Use this skill when:

- the user gives a broad question in one sentence
- the topic spans architecture, market, strategy, or tradeoffs
- you are not yet confident what queries should be searched first
- the report quality depends on covering different angles instead of repeating similar searches

Examples:

- "帮我研究一下 MCP 和 Agent 的关系"
- "Analyze the competitive landscape for AI coding agents"
- "评估某个开源项目的技术架构和风险"

## Goal

Produce a balanced query set that covers multiple research intents instead of many near-duplicate searches.

The preferred intents are:

- overview
- implementation
- comparison
- risk
- trend
- evidence

## Workflow

1. Identify the real research object: concept, product, repo, architecture, company, trend, or workflow.
2. Extract 3-5 research angles that are materially different.
3. Generate 1-2 queries per angle.
4. Make sure the total query set covers multiple intents.
5. Avoid redundant wording and near-duplicate searches.
6. If the topic is technical, prioritize implementation, architecture, and limitations.
7. If the topic is business or market oriented, prioritize overview, comparison, market evidence, and trend.

## Query Design Rules

- Prefer concrete keywords over vague natural-language questions.
- Include official terminology, product names, repo names, protocol names, and important alternatives.
- Add comparison queries when a decision or evaluation is implied.
- Add risk or limitation queries when recommendations may be made.
- Add evidence queries when claims need measurable support.
- Do not create filler queries that only restate the topic.

## Output Format

When using this skill, produce a compact markdown query plan like this:

```md
## Query Plan

### Angle 1: Core overview
- Intent: overview
  - query: ...

### Angle 2: Technical implementation
- Intent: implementation
  - query: ...

### Angle 3: Risks and limitations
- Intent: risk
  - query: ...
```

## Quality Bar

A good query plan should:

- cover at least 3 distinct angles
- include at least 4 useful queries
- contain at least 3 different intents
- make later search and quality review easier

If the topic already contains a GitHub repository, official product name, or known framework, use that explicit identifier in the queries.
