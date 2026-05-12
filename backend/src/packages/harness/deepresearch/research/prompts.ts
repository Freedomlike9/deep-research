/**
 * Optimized prompts: leaner instructions, report uses notes only (not raw sources).
 */

export const buildPlanPrompt = ({
  topic,
  language,
  formatInstructions
}: {
  topic: string;
  language: string;
  formatInstructions: string;
}) => `你是研究员，需要规划对以下主题的研究。
主题：${topic}
输出语言：${language}
要求：产出3-5个研究角度，4-6条搜索查询，覆盖概念、应用、数据、挑战与趋势。
${formatInstructions}`;

export const buildAnalysisPrompt = ({
  topic,
  language,
  sources
}: {
  topic: string;
  language: string;
  sources: string;
}) => `你是研究分析员。请基于以下资料输出结构化 JSON，不要输出额外说明。
主题：${topic}
语言：${language}
资料：
${sources}

输出 JSON 结构：
{
  "summary": "一句到三句总结",
  "findings": [
    {
      "claim": "核心结论",
      "confidence": "low|medium|high",
      "evidence": [
        {
          "sourceId": "来源ID",
          "title": "来源标题",
          "url": "来源URL",
          "summary": "这条来源支持该结论的要点"
        }
      ],
      "missingEvidence": ["仍缺失的证据，可为空"]
    }
  ],
  "openQuestions": ["仍待确认的问题"]
}

要求：
- findings 给出 3-6 条
- 每条 finding 至少包含 1 条 evidence
- 只能引用资料里出现过的 sourceId/url
- 如果证据不足，降低 confidence，不要编造。`;

export const buildQualityCheckPrompt = ({
  topic,
  language,
  notes,
  iteration,
  maxIterations,
  sourceCount,
  formatInstructions
}: {
  topic: string;
  language: string;
  notes: string;
  iteration: number;
  maxIterations: number;
  sourceCount: number;
  formatInstructions: string;
}) => `你是研究质量审核员。请判断当前研究材料是否足以生成高质量报告。

主题：${topic}
语言：${language}
当前轮次：第 ${iteration + 1} 轮（最多 ${maxIterations} 轮补充）
已收集来源数：${sourceCount}

请按以下标准判断：
1. 关键发现是否已有足够证据支撑
2. 是否还有明显未覆盖的核心角度
3. 是否有结论证据偏弱但仍影响最终报告质量

仅当存在明显信息缺口时才设 needsMore 为 true。
如果来源数量过少、缺少关键维度、或多个核心结论证据弱，可以要求继续搜索。

返回 JSON，字段必须包含：
- needsMore: boolean
- newQueries: string[]
- uncoveredAngles: string[]
- weakClaims: string[]

已有材料：
${notes}
${formatInstructions}`;

export const buildReportPrompt = ({
  topic,
  language,
  plan,
  notes,
  sourceList
}: {
  topic: string;
  language: string;
  plan: string;
  notes: string;
  sourceList: string;
}) => `请输出一份可直接保存为 .md 文件的最终研究报告。
硬性要求：
- 仅输出纯 Markdown，不要包裹在 \`\`\`markdown 代码块中。
- 标题层级清晰，一级标题只保留 1 个。
- 保持正式、易读、适合分享的研究报告风格，不要写成零散笔记。
- 每条事实性结论尽量附带引用，引用格式统一为 source refs，如 [S1]、[S2]，并且只能使用“来源索引”中提供的编号，在“来源清单”中列出对应来源。
- 不要直接暴露裸 URL；正文优先使用 [S1] 这类引用编号，完整链接放在“来源清单”。
- 优先使用短段落、项目列表、对比表格，让报告有明显的信息分层。
- 正文段落与"来源清单"之间必须用空行隔开；每个章节（## 标题）前后各空一行。
- 来源清单中每条来源独占一行，格式为 \`- [标题](URL)\`。
- 如果资料不足，不要编造；直接说明信息缺口。

请尽量遵循以下结构：
# ${topic}
> 一句话总结研究结论

## 执行摘要
- 用 3-5 条要点总结最重要发现

## 研究范围与方法
- 说明本次研究关注的问题、分析口径、资料范围

## 关键发现
### 发现一
- 结论
- 证据与引用

## 案例与数据
- 优先整理成列表或表格

## 风险与局限
- 风险、争议、信息缺口、适用边界

## 趋势与判断
- 短期趋势
- 中期观察

## 来源清单
- 每条来源格式：\`- [标题](URL)\`
- 不要暴露裸 URL，所有链接都使用 Markdown 超链接

主题：${topic}
语言：${language}
研究角度：
${plan}
研究笔记（核心依据）：
${notes}
来源索引：
${sourceList}

要求：正文中的引用编号必须与上面的来源索引完全一致，不要创建不存在的 [Sx]。`;
