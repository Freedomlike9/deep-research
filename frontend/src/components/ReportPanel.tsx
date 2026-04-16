import type { ProgressEvent } from "../lib/api";

interface ReportPanelProps {
  threadId?: string;
  title?: string;
  report: string;
  reportPath?: string;
  stats?: { sources: number; iterations: number };
  loading?: boolean;
  debug?: {
    usedSkills: Array<{ name: string; description: string }>;
    mcpResources: Array<{ title: string }>;
  };
  error?: string;
  progressEvents?: ProgressEvent[];
  activeStepLabel?: string;
  activeMessage?: string;
  activeProgress?: {
    current: number;
    total: number;
  };
  isTyping?: boolean;
}

const formatEventTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

export const ReportPanel = ({
  threadId,
  title,
  report,
  reportPath,
  stats,
  debug,
  loading,
  error,
  progressEvents = [],
  activeStepLabel,
  activeMessage,
  activeProgress,
  isTyping
}: ReportPanelProps) => {
  const renderInline = (text: string) => {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const pattern = /(`[^`]+`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    let cursor = 0;
    let html = "";

    for (const match of text.matchAll(pattern)) {
      const [token] = match;
      const index = match.index ?? 0;
      html += escapeHtml(text.slice(cursor, index));

      if (token.startsWith("`")) {
        html += `<code>${escapeHtml(token.slice(1, -1))}</code>`;
      } else if (token.startsWith("[")) {
        const label = match[2] ?? token;
        const href = match[3] ?? "#";
        html += `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
      } else if (token.startsWith("**")) {
        html += `<strong>${escapeHtml(match[4] ?? token.slice(2, -2))}</strong>`;
      } else if (token.startsWith("*")) {
        html += `<em>${escapeHtml(match[5] ?? token.slice(1, -1))}</em>`;
      }

      cursor = index + token.length;
    }

    html += escapeHtml(text.slice(cursor));
    return html;
  };

  const renderMarkdown = (markdown: string) => {
    if (!markdown.trim()) {
      return "";
    }

    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const html: string[] = [];
    let index = 0;

    const isListItem = (line: string) => /^(\d+\.\s+|[-*+]\s+)/.test(line.trim());
    const isTableDivider = (line: string) => /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line);
    const isHr = (line: string) => /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line);

    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed) {
        index += 1;
        continue;
      }

      const codeFence = trimmed.match(/^```(\S+)?\s*$/);
      if (codeFence) {
        const language = codeFence[1] ?? "";
        index += 1;
        const block: string[] = [];
        while (index < lines.length && !lines[index].trim().startsWith("```")) {
          block.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) {
          index += 1;
        }
        const escaped = block
          .join("\n")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        html.push(
          `<pre class="md-code-block"><div class="md-code-label">${language || "text"}</div><code>${escaped}</code></pre>`
        );
        continue;
      }

      const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
        index += 1;
        continue;
      }

      if (isHr(trimmed)) {
        html.push("<hr />");
        index += 1;
        continue;
      }

      if (
        trimmed.includes("|") &&
        index + 1 < lines.length &&
        isTableDivider(lines[index + 1])
      ) {
        const parseRow = (value: string) =>
          value
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((cell) => cell.trim());

        const headers = parseRow(lines[index]);
        index += 2;
        const bodyRows: string[][] = [];
        while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
          bodyRows.push(parseRow(lines[index]));
          index += 1;
        }

        html.push(
          `<div class="md-table-wrap"><table><thead><tr>${headers
            .map((cell) => `<th>${renderInline(cell)}</th>`)
            .join("")}</tr></thead><tbody>${bodyRows
            .map(
              (row) =>
                `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`
            )
            .join("")}</tbody></table></div>`
        );
        continue;
      }

      if (trimmed.startsWith(">")) {
        const quote: string[] = [];
        while (index < lines.length && lines[index].trim().startsWith(">")) {
          quote.push(lines[index].trim().replace(/^>\s?/, ""));
          index += 1;
        }
        html.push(`<blockquote>${quote.map((item) => `<p>${renderInline(item)}</p>`).join("")}</blockquote>`);
        continue;
      }

      if (isListItem(line)) {
        const ordered = /^\d+\.\s+/.test(trimmed);
        const items: string[] = [];
        while (index < lines.length && isListItem(lines[index])) {
          items.push(lines[index].trim().replace(/^(\d+\.\s+|[-*+]\s+)/, ""));
          index += 1;
        }
        html.push(
          `<${ordered ? "ol" : "ul"}>${items
            .map((item) => `<li>${renderInline(item)}</li>`)
            .join("")}</${ordered ? "ol" : "ul"}>`
        );
        continue;
      }

      const paragraph: string[] = [];
      while (
        index < lines.length &&
        lines[index].trim() &&
        !lines[index].trim().startsWith("```") &&
        !lines[index].trim().startsWith(">") &&
        !isListItem(lines[index]) &&
        !isHr(lines[index].trim()) &&
        !/^(#{1,6})\s+/.test(lines[index].trim())
      ) {
        if (
          lines[index].includes("|") &&
          index + 1 < lines.length &&
          isTableDivider(lines[index + 1])
        ) {
          break;
        }
        paragraph.push(lines[index].trim());
        index += 1;
      }
      html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    }

    return html.join("");
  };

  const placeholder = loading
    ? [
        "# 研究报告正在生成",
        "",
        `> ${activeStepLabel || "Starting"}`,
        "",
        activeMessage ? `当前进展：${activeMessage}` : "当前进展：正在整理研究结果",
        activeProgress ? `进度：${activeProgress.current}/${activeProgress.total}` : "",
        "",
        "## 报告结构已就绪",
        "- 执行摘要",
        "- 关键发现与证据",
        "- 案例与数据",
        "- 风险与局限",
        "- 趋势与判断",
        "- 来源清单"
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const renderedHtml = renderMarkdown(report || placeholder);

  return (
  <section className="panel report-panel">
    <div className="panel-header">
      <h2>Research Result</h2>
      <p>Final markdown output generated by the lead research chain.</p>
    </div>

    {error ? <div className="error-box">{error}</div> : null}

    <div className="report-meta">
      <div>
        <span className="meta-label">Thread</span>
        <strong>{threadId || "Pending"}</strong>
      </div>
      <div>
        <span className="meta-label">Title</span>
        <strong>{title || "No title yet"}</strong>
      </div>
      <div>
        <span className="meta-label">Artifacts</span>
        <strong>{reportPath || "Not generated"}</strong>
      </div>
      <div>
        <span className="meta-label">Stats</span>
        <strong>{stats ? `${stats.sources} sources / ${stats.iterations} iterations` : "Pending"}</strong>
      </div>
    </div>

    <div className="debug-grid">
      <div className="debug-block">
        <span className="meta-label">Used Skills</span>
        <strong>
          {debug?.usedSkills?.length
            ? debug.usedSkills.map((skill) => skill.name).join(", ")
            : "Loaded from latest report or not returned yet"}
        </strong>
      </div>
      <div className="debug-block">
        <span className="meta-label">MCP Resources</span>
        <strong>
          {debug?.mcpResources?.length
            ? debug.mcpResources.map((resource) => resource.title).join(", ")
            : "Loaded from latest report or not returned yet"}
        </strong>
      </div>
    </div>

    {loading || progressEvents.length ? (
      <section className={`progress-panel ${loading ? "is-live" : ""}`}>
        <div className="progress-panel-header">
          <div>
            <span className="meta-label">Live Progress</span>
            <strong>{activeStepLabel || (loading ? "Starting" : "Completed")}</strong>
          </div>
          {activeProgress ? (
            <div className="progress-counter">
              {activeProgress.current}/{activeProgress.total}
            </div>
          ) : null}
        </div>

        <p className="progress-message">{activeMessage || "Waiting for progress updates..."}</p>

        {activeProgress ? (
          <div
            className="progress-bar"
            role="progressbar"
            aria-valuenow={activeProgress.current}
            aria-valuemin={0}
            aria-valuemax={activeProgress.total}
          >
            <span
              style={{
                width: `${activeProgress.total > 0 ? (activeProgress.current / activeProgress.total) * 100 : 0}%`
              }}
            />
          </div>
        ) : null}

        <div className="progress-feed">
          {progressEvents.length ? (
            progressEvents
              .slice()
              .reverse()
              .map((event, index) => (
                <div key={`${event.timestamp}-${index}`} className={`progress-item type-${event.type}`}>
                  <div className="progress-item-meta">
                    <strong>{event.step || event.type}</strong>
                    <span>{formatEventTime(event.timestamp)}</span>
                  </div>
                  <p>{event.message}</p>
                </div>
              ))
          ) : (
            <div className="progress-empty">No progress events yet.</div>
          )}
        </div>
      </section>
    ) : null}

    <div className={`report-content ${loading ? "is-loading" : ""} ${isTyping ? "is-typing" : ""}`}>
      {renderedHtml ? (
        <div
          className="report-markdown"
          aria-live={isTyping ? "polite" : undefined}
          dangerouslySetInnerHTML={{
            __html: `${renderedHtml}${isTyping ? '<span class="typewriter-cursor" aria-hidden="true"></span>' : ""}`
          }}
        />
      ) : (
        <div className="report-empty">Your generated report will appear here.</div>
      )}
    </div>
  </section>
  );
};
