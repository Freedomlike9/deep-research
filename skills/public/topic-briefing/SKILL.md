---
name: topic-briefing
description: Use this skill when the user has a vague topic, project idea, or research direction and needs a fast structured briefing before deeper work. It turns a raw topic into a concise markdown brief with goals, assumptions, key questions, risks, and recommended next steps.
---

# Topic Briefing Skill

Use this skill to turn a rough topic into a structured kickoff brief.

This skill is a good example of a complete skill layout:

- `SKILL.md` defines when to use the skill and the workflow
- `scripts/generate_brief.js` performs deterministic brief generation
- `references/brief-patterns.md` contains the section rubric and writing guidance
- `assets/output-template.md` provides a reusable markdown layout

## When To Use

Use this skill when the user says things like:

- "帮我梳理一下这个主题"
- "先帮我形成一个研究提纲"
- "turn this idea into a project brief"
- "给这个方向做个 kickoff brief"

Do not use it for full deep research reports. Use it to create a starting brief that can guide later research.

## Workflow

1. Clarify the raw topic, target audience, and language.
2. Read `references/brief-patterns.md` if you need the section rubric.
3. Reuse `assets/output-template.md` when you want a stable markdown structure.
4. Run the JS script to generate the initial brief.
5. Present the generated brief directly, then suggest follow-up research or execution steps.

## Script Usage

Run the script directly instead of manually writing the same structure each time:

```bash
node /mnt/skills/public/topic-briefing/scripts/generate_brief.js \
  --topic "为中小团队设计一个 AI 研究助理工作台" \
  --audience "产品经理" \
  --language "zh-CN"
```

Optional parameters:

- `--topic` required
- `--audience` optional, defaults to `general`
- `--language` optional, defaults to `zh-CN`
- `--template` optional, path to a markdown template

## Output Expectations

The brief should be concise and useful for kickoff, not a long report.

It should include:

- topic framing
- objective
- working assumptions
- key questions
- risks
- recommended next actions

If the topic is technical, keep terminology concrete.
If the topic is strategic, emphasize tradeoffs and unknowns.

## Notes

- Keep the final brief readable in markdown.
- If the user later asks for deeper research, pass this brief into the broader research workflow.
- For the exact section rubric, read `references/brief-patterns.md`.
