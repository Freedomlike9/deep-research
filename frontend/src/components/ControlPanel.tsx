import { useState } from "react";
import type { HistoryRecord } from "../lib/api";

interface ControlPanelProps {
  topic: string;
  language: string;
  historyRecords: HistoryRecord[];
  selectedThreadId?: string;
  onTopicChange(value: string): void;
  onLanguageChange(value: string): void;
  onSelectHistory(threadId: string): void;
  onDeleteHistory(threadId: string): void;
  onSubmit(): void;
  loading: boolean;
}

const LANGUAGE_OPTIONS = [
  { value: "zh-CN", label: "中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
] as const;

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

export const ControlPanel = ({
  topic,
  language,
  historyRecords,
  selectedThreadId,
  onTopicChange,
  onLanguageChange,
  onSelectHistory,
  onDeleteHistory,
  onSubmit,
  loading
}: ControlPanelProps) => {
  const [historyOpen, setHistoryOpen] = useState(true);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !loading && topic.trim()) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <section className="panel control-panel">
      <div className="panel-header">
        <h2>Research Setup</h2>
      </div>

      <label className="field">
        <span>Topic</span>
        <textarea
          value={topic}
          onChange={(event) => onTopicChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你想深入研究的主题..."
        />
      </label>

      <div className="field">
        <span>Language</span>
        <div className="language-select">
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`language-option ${language === option.value ? "active" : ""}`}
              onClick={() => onLanguageChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <button className="primary-button" onClick={onSubmit} disabled={loading || !topic.trim()}>
        {loading ? "Researching..." : "Run Deep Research"}
      </button>

      {historyRecords.length > 0 && (
        <div className="subsection history-section">
          <button
            className="history-toggle"
            onClick={() => setHistoryOpen((prev) => !prev)}
            aria-expanded={!loading && historyOpen}
          >
            <span>History ({historyRecords.length})</span>
            <span className={`history-chevron ${!loading && historyOpen ? "open" : ""}`}>▾</span>
          </button>

          {!loading && historyOpen && (
            <ul className="history-list">
              {historyRecords.map((record) => (
                <li
                  key={record.threadId}
                  className={`history-item ${record.threadId === selectedThreadId ? "active" : ""}`}
                  onClick={() => onSelectHistory(record.threadId)}
                  title={record.topic}
                >
                  <span className="history-title">{record.title}</span>
                  <span className="history-meta-row">
                    <span className="history-date">{formatDate(record.createdAt)}</span>
                    <span className="history-stats">{record.stats.sources} sources</span>
                  </span>
                  <button
                    className="history-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm("确认删除该研究记录？")) {
                        onDeleteHistory(record.threadId);
                      }
                    }}
                    title="删除"
                    aria-label="删除"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};
