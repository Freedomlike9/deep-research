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
}) => `基于以下资料整理研究笔记，每条结论携带引用[citation:标题](URL)。
主题：${topic}
语言：${language}
资料：
${sources}
要求：以条目列出关键结论与数据，必须包含引用。`;

export const buildQualityCheckPrompt = ({
  topic,
  language,
  notes,
  formatInstructions
}: {
  topic: string;
  language: string;
  notes: string;
  formatInstructions: string;
}) => `判断研究是否完整。如关键数据/案例/趋势缺失则needsMore为true并给2-3条新查询。
主题：${topic}
语言：${language}
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
- 每条事实性结论尽量附带引用，引用格式统一为 [标题](URL)。
- 优先使用短段落、项目列表、对比表格，让报告有明显的信息分层。
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
- 按来源列出标题与链接

主题：${topic}
语言：${language}
研究角度：
${plan}
研究笔记（核心依据）：
${notes}
来源索引：
${sourceList}`;
