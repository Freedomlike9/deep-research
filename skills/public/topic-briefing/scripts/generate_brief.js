#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = value;
    index += 1;
  }
  return args;
};

const titleCase = (input) =>
  input
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");

const inferTopicMode = (topic) => {
  if (/(agent|workflow|api|system|平台|架构|技术|工程|代码)/i.test(topic)) {
    return "technical";
  }
  if (/(market|strategy|竞争|行业|增长|商业)/i.test(topic)) {
    return "strategy";
  }
  return "product";
};

const buildBulletBlock = (items) => items.map((item) => `- ${item}`).join("\n");

const createBrief = ({ topic, audience, language }) => {
  const mode = inferTopicMode(topic);
  const isChinese = /^zh/i.test(language);
  const title = isChinese ? `${topic} 启动简报` : `${titleCase(topic)} Kickoff Brief`;

  const snapshot = isChinese
    ? `该主题目前仍处于早期梳理阶段，适合先形成一个可执行的研究与决策起点。`
    : `This topic is still at an early framing stage and benefits from a concise kickoff brief before deeper execution.`;

  const objective = isChinese
    ? `明确“${topic}”要解决的问题、判断标准以及下一步研究重点。`
    : `Clarify the problem space, decision criteria, and near-term research priorities for "${topic}".`;

  const assumptions =
    mode === "technical"
      ? isChinese
        ? [
            "需要先明确系统边界，而不是直接扩展实现。",
            "关键风险通常来自依赖、性能与维护复杂度。",
            "后续研究需要结合真实代码结构或技术栈。"
          ]
        : [
            "System boundaries should be clarified before expanding implementation.",
            "Key risks usually come from dependencies, performance, and maintenance complexity.",
            "Later research should anchor on the real codebase or stack."
          ]
      : mode === "strategy"
        ? isChinese
          ? [
              "现阶段需要先收敛目标与比较维度。",
              "竞争格局和执行成本都可能影响最终方向。",
              "后续研究需要更多外部证据支撑判断。"
            ]
          : [
              "The near-term goal is to narrow the objective and comparison axes.",
              "Competitive context and execution cost can materially affect the direction.",
              "Later research needs stronger external evidence."
            ]
        : isChinese
          ? [
              "需要先明确目标用户与核心场景。",
              "方案价值应通过流程效率或体验提升来衡量。",
              "后续研究需要验证需求强度与落地门槛。"
            ]
          : [
              "Target users and core scenarios should be clarified first.",
              "Value should be measured through workflow efficiency or experience gains.",
              "Later research should validate demand strength and delivery cost."
            ];

  const questions =
    mode === "technical"
      ? isChinese
        ? [
            `“${topic}”的核心模块和边界分别是什么？`,
            "哪些能力应该通过扩展实现，哪些应该保持内核简单？",
            "当前实现最可能出现的复杂度瓶颈在哪里？"
          ]
        : [
            `What are the core modules and boundaries of "${topic}"?`,
            "Which capabilities belong in extensions versus the core system?",
            "Where is complexity most likely to become a bottleneck?"
          ]
      : mode === "strategy"
        ? isChinese
          ? [
              `“${topic}”的主要决策对象和受益方是谁？`,
              "有哪些替代方案值得比较？",
              "如果资源有限，最值得优先验证的是什么？"
            ]
          : [
              `Who are the primary decision makers and beneficiaries for "${topic}"?`,
              "Which alternatives are worth comparing?",
              "What should be validated first if resources are constrained?"
            ]
        : isChinese
          ? [
              `“${topic}”优先服务哪个用户场景？`,
              "用户为什么会持续使用而不是尝试一次后离开？",
              "第一版最小可行范围应该怎么定义？"
            ]
          : [
              `Which user scenario should "${topic}" serve first?`,
              "Why would users stay instead of trying it once and leaving?",
              "How should the first minimum viable scope be defined?"
            ];

  const risks = isChinese
    ? [
        "问题定义过宽，导致研究结果无法指导行动。",
        "过早进入实现，掩盖了关键前提未验证的问题。",
        "缺少比较基线，难以判断方案优劣。"
      ]
    : [
        "The scope may stay too broad to guide action.",
        "Implementation may start before key assumptions are validated.",
        "Without a comparison baseline, decisions may stay weak."
      ];

  const nextSteps = isChinese
    ? [
        "把主题进一步拆成 3 到 5 个可研究子问题。",
        "确认目标受众与输出形式。",
        "进入一轮更完整的 deep research，补齐证据和对比。"
      ]
    : [
        "Break the topic into 3 to 5 researchable sub-questions.",
        "Confirm the audience and output format.",
        "Run a deeper research pass to add evidence and comparisons."
      ];

  return {
    title,
    snapshot,
    objective,
    audience,
    assumptions: buildBulletBlock(assumptions),
    questions: buildBulletBlock(questions),
    risks: buildBulletBlock(risks),
    next_steps: buildBulletBlock(nextSteps)
  };
};

const renderTemplate = (template, data) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const topic = args.topic;
  if (!topic) {
    process.stderr.write("Missing required argument: --topic\n");
    process.exit(1);
  }

  const audience = args.audience || "general";
  const language = args.language || "zh-CN";
  const skillRoot = path.resolve(__dirname, "..");
  const templatePath = args.template || path.join(skillRoot, "assets", "output-template.md");
  const template = fs.readFileSync(templatePath, "utf8");
  const brief = createBrief({ topic, audience, language });
  process.stdout.write(`${renderTemplate(template, brief)}\n`);
};

main();
