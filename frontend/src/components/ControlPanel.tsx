import type { McpServerItem, SkillItem } from "../lib/api";

interface ControlPanelProps {
  topic: string;
  language: string;
  dryRun: boolean;
  skills: SkillItem[];
  mcpServers: Record<string, McpServerItem>;
  onTopicChange(value: string): void;
  onLanguageChange(value: string): void;
  onDryRunChange(value: boolean): void;
  onToggleSkill(skillName: string, enabled: boolean): void;
  onSubmit(): void;
  loading: boolean;
}

export const ControlPanel = ({
  topic,
  language,
  dryRun,
  skills,
  mcpServers,
  onTopicChange,
  onLanguageChange,
  onDryRunChange,
  onToggleSkill,
  onSubmit,
  loading
}: ControlPanelProps) => (
  <section className="panel control-panel">
    <div className="panel-header">
      <h2>Research Setup</h2>
      <p>Configure the lead agent, then run a report generation cycle.</p>
    </div>

    <label className="field">
      <span>Topic</span>
      <textarea
        value={topic}
        onChange={(event) => onTopicChange(event.target.value)}
        placeholder="Research LangGraph-based open source deep research frameworks"
      />
    </label>

    <div className="field-row">
      <label className="field">
        <span>Language</span>
        <input value={language} onChange={(event) => onLanguageChange(event.target.value)} />
      </label>

      <label className="toggle">
        <input type="checkbox" checked={dryRun} onChange={(event) => onDryRunChange(event.target.checked)} />
        <span>Dry Run</span>
      </label>
    </div>

    <div className="subsection">
      <h3>Enabled Skills</h3>
      <div className="token-list">
        {skills.map((skill) => (
          <label key={skill.name} className={`token ${skill.enabled ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={skill.enabled}
              onChange={(event) => onToggleSkill(skill.name, event.target.checked)}
            />
            <span>{skill.name}</span>
          </label>
        ))}
      </div>
    </div>

    <div className="subsection">
      <h3>MCP Context</h3>
      <ul className="server-list">
        {Object.entries(mcpServers).map(([name, server]) => (
          <li key={name}>
            <strong>{name}</strong>
            <span>{server.description}</span>
          </li>
        ))}
      </ul>
    </div>

    <button className="primary-button" onClick={onSubmit} disabled={loading || !topic.trim()}>
      {loading ? "Researching..." : "Run Deep Research"}
    </button>
  </section>
);
