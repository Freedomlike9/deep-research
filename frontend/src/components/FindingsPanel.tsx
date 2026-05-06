import type { ResearchFinding } from "../lib/api";

interface FindingsPanelProps {
  findings: ResearchFinding[];
}

export const FindingsPanel = ({ findings }: FindingsPanelProps) => {
  if (!findings.length) {
    return null;
  }

  return (
    <section className="insight-panel">
      <div className="panel-header compact-header">
        <h3>Key Findings</h3>
      </div>
      <div className="insight-list">
        {findings.map((finding, index) => (
          <article key={`${finding.claim}-${index}`} className="insight-card">
            <div className="insight-topline">
              <span className={`confidence-badge confidence-${finding.confidence}`}>{finding.confidence}</span>
              <span className="evidence-count">{finding.evidence.length} evidence</span>
            </div>
            <strong>{finding.claim}</strong>
            <ul className="evidence-list">
              {finding.evidence.slice(0, 3).map((evidence) => (
                <li key={`${finding.claim}-${evidence.sourceId}`}>
                  <a href={evidence.url} target="_blank" rel="noreferrer">
                    {evidence.title}
                  </a>
                  <span>{evidence.summary}</span>
                </li>
              ))}
            </ul>
            {finding.missingEvidence?.length ? (
              <p className="missing-evidence">Missing: {finding.missingEvidence.join("; ")}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
};
