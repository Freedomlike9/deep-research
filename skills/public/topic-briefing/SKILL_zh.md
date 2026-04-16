---
name: topic-briefing
description: 当用户只有模糊主题、项目想法或研究方向，需要在深入开展前快速获得结构化简报时使用。该技能可将原始主题转为简洁的 markdown 简报，包含目标、假设、关键问题、风险与建议下一步。
---

# 主题简报技能

使用该技能可将粗略主题转换为结构化启动简报。

该技能是完整技能布局的示例：

- `SKILL.md` 定义技能何时使用及工作流
- `scripts/generate_brief.js` 负责确定性简报生成
- `references/brief-patterns.md` 包含章节准则与写作建议
- `assets/output-template.md` 提供可复用的 markdown 模板

## 何时使用

当用户提出类似以下请求时使用：

- "帮我梳理一下这个主题"
- "先帮我形成一个研究提纲"
- "turn this idea into a project brief"
- "给这个方向做个 kickoff brief"

不要把它用于完整深度研究报告。它适合先产出一个可指导后续研究的起始简报。

## 工作流

1. 澄清原始主题、目标受众和语言。
2. 需要章节准则时，阅读 `references/brief-patterns.md`。
3. 需要稳定 markdown 结构时，复用 `assets/output-template.md`。
4. 运行 JS 脚本生成初始简报。
5. 直接展示生成结果，并建议后续研究或执行步骤。

## 脚本用法

每次应直接运行脚本，而不是手写同样结构：

```bash
node /mnt/skills/public/topic-briefing/scripts/generate_brief.js   --topic "为中小团队设计一个 AI 研究助理工作台"   --audience "产品经理"   --language "zh-CN"
```

可选参数：

- `--topic` 必填
- `--audience` 可选，默认 `general`
- `--language` 可选，默认 `zh-CN`
- `--template` 可选，markdown 模板路径

## 输出预期

简报应简洁且适合启动阶段，不应写成长篇报告。

应包含：

- 主题界定
- 目标
- 工作假设
- 关键问题
- 风险
- 建议的下一步行动

如果主题偏技术，术语要具体。
如果主题偏战略，突出取舍与未知项。

## 备注

- 保持最终简报在 markdown 中易读。
- 若用户后续需要深度研究，将该简报传入更广泛的研究流程。
- 章节细则请阅读 `references/brief-patterns.md`。
