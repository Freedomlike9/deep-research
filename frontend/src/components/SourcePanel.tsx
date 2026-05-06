import type { ResearchSource } from "../lib/api";

interface SourcePanelProps {
  sources: ResearchSource[];
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

export const SourcePanel = ({ sources }: SourcePanelProps) => {
  if (!sources.length) {
    return null;
  }

  const sorted = [...sources].sort((a, b) => b.score.total - a.score.total);

  return (
    <section className="insight-panel">
      <div className="panel-header compact-header">
        <h3>Sources</h3>
      </div>
      <div className="source-list">
        {sorted.map((source) => (
          <article key={source.id} className="source-card">
            <div className="source-header-row">
              <strong>{source.title}</strong>
              <span className={`source-status status-${source.fetchStatus}`}>{source.fetchStatus}</span>
            </div>
            <a href={source.url} target="_blank" rel="noreferrer" className="source-domain">
              {source.domain || source.url}
            </a>
            {source.snippet ? <p className="source-snippet">{source.snippet}</p> : null}
            <div className="source-metrics">
              <span>Total {percent(source.score.total)}</span>
              <span>Auth {percent(source.score.authority)}</span>
              <span>Rel {percent(source.score.relevance)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
