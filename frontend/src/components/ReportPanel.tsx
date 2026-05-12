import type { ReactNode } from "react";
import type { ProgressEvent } from "../lib/api";

interface ReportPanelProps {
  title?: string;
  report: string;
  stats?: { sources: number; iterations: number };
  loading?: boolean;
  error?: string;
  progressEvents?: ProgressEvent[];
  activeStepLabel?: string;
  activeMessage?: string;
  activeProgress?: {
    current: number;
    total: number;
  };
  isTyping?: boolean;
  actions?: ReactNode;
}

const formatEventTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

export const ReportPanel = ({
  title,
  report,
  stats,
  loading,
  error,
  progressEvents = [],
  activeStepLabel,
  activeMessage,
  activeProgress,
  isTyping,
  actions
}: ReportPanelProps) => {
  const renderInline = (text: string) => {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const splitUrlToken = (value: string) => {
      let href = value;
      let suffix = "";

      while (href.length) {
        const last = href[href.length - 1];
        if (/[.,;!?]/.test(last)) {
          suffix = last + suffix;
          href = href.slice(0, -1);
          continue;
        }
        if (last === ")") {
          const openCount = (href.match(/\(/g) || []).length;
          const closeCount = (href.match(/\)/g) || []).length;
          if (closeCount > openCount) {
            suffix = last + suffix;
            href = href.slice(0, -1);
            continue;
          }
        }
        break;
      }

      return { href, suffix };
    };

    // Normalize non-standard citation patterns before regex matching:
    // [citation:Title](URL) → [Title](URL)
    // [Title] (URL) with accidental space → [Title](URL)
    const normalized = text
      .replace(/\[citation:([^\]]+)\]/g, "[$1]")
      .replace(/\[([^\]]+)\]\s+\((https?:\/\/)/g, "[$1]($2");

    const pattern =
      /(`[^`]+`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    let cursor = 0;
    let html = "";

    for (const match of normalized.matchAll(pattern)) {
      const [token] = match;
      const index = match.index ?? 0;
      html += escapeHtml(normalized.slice(cursor, index));

      if (token.startsWith("`")) {
        html += `<code>${escapeHtml(token.slice(1, -1))}</code>`;
      } else if (token.startsWith("[")) {
        const label = match[2] ?? token;
        const href = match[3] ?? "#";
        html += `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
      } else if (token.startsWith("http")) {
        const { href, suffix } = splitUrlToken(match[4] ?? token);
        html += `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(href)}</a>${escapeHtml(suffix)}`;
      } else if (token.startsWith("**")) {
        html += `<strong>${escapeHtml(match[5] ?? token.slice(2, -2))}</strong>`;
      } else if (token.startsWith("*")) {
        html += `<em>${escapeHtml(match[6] ?? token.slice(1, -1))}</em>`;
      }

      cursor = index + token.length;
    }

    html += escapeHtml(normalized.slice(cursor));
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
    const isSourceLine = (line: string) =>
      /^(数据来源|来源|资料来源|参考来源|参考链接|链接来源|出处|Sources?|References?|Bibliography|Citations?)\s*[：:]/i.test(line.trim());
    const isStandaloneUrlLine = (line: string) => {
      const t = line.trim();
      return (
        /^\(?https?:\/\/\S+\)?$/.test(t) ||
        /^\[\d+\]\s/.test(t) ||
        /^[-*+]\s+\[.+\]\(https?:\/\//.test(t)
      );
    };

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

      if (isSourceLine(trimmed)) {
        const sourceLines: string[] = [];
        while (
          index < lines.length &&
          lines[index].trim() &&
          (isSourceLine(lines[index]) || isStandaloneUrlLine(lines[index]))
        ) {
          sourceLines.push(lines[index].trim());
          index += 1;
        }
        html.push(
          `<div class="md-source-block">${sourceLines
            .map((item) => `<p class="md-source-line">${renderInline(item)}</p>`)
            .join("")}</div>`
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
        !/^(#{1,6})\s+/.test(lines[index].trim()) &&
        !isSourceLine(lines[index].trim())
      ) {
        if (
          lines[index].includes("|") &&
          index + 1 < lines.length &&
          isTableDivider(lines[index + 1])
        ) {
          break;
        }
        if (isStandaloneUrlLine(lines[index])) {
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
      <div className="report-panel-top">
        <div className="panel-header">
          <h2>{title || "Research Result"}</h2>
        </div>

        <div className="report-panel-side">
          {stats && (
            <div className="report-stats">
              <span className="stat-chip">{stats.sources} sources</span>
              <span className="stat-chip">{stats.iterations} iterations</span>
            </div>
          )}
          {actions ? <div className="report-panel-actions">{actions}</div> : null}
        </div>
      </div>

      {error ? <div className="error-box">{error}</div> : null}

      {(loading || progressEvents.length > 0) && (
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
      )}

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
