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
}) => `基于以下资料整理研究笔记，每条结论携带引用，格式为标准 Markdown 链接 [标题](URL)。
主题：${topic}
语言：${language}
资料：
${sources}
要求：以条目列出关键结论与数据，必须包含引用。`;

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
}) => `你是研究质量审核员。请判断当前研究笔记是否已经足够撰写一份高质量报告。

主题：${topic}
语言：${language}
当前轮次：第 ${iteration + 1} 轮（最多 ${maxIterations} 轮补充）
已收集来源数：${sourceCount}

判断标准（满足任一即可认为"完整"）：
1. 主题的核心概念、关键数据、主要案例已有覆盖
2. 至少有 3 个不同角度的信息来源
3. 已有笔记能支撑"执行摘要 + 关键发现 + 案例数据 + 风险局限"四个章节

仅当存在 **明显的、具体的信息缺口**（例如完全缺少某个关键维度的数据）时，才设 needsMore 为 true，并给出 1-2 条精确的补充查询。
不要因为"还可以更深入"就要求补充——边际收益递减时应停止。

已有笔记：
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
- 每条事实性结论尽量附带引用，引用格式统一为标准 Markdown 链接 [标题](URL)，不要使用 [citation:...] 等自创格式。
- 所有链接必须使用 [显示文字](URL) 格式，不要直接暴露裸 URL。
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
${sourceList}`;
