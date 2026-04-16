import { startTransition, useEffect, useRef, useState } from "react";
import { ControlPanel } from "./components/ControlPanel";
import { ReportPanel } from "./components/ReportPanel";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import {
  api,
  type ReportChunkPayload,
  streamResearch,
  type McpServerItem,
  type ProgressEvent,
  type ResearchDebug,
  type ResearchStep,
  type SkillItem,
  type StreamDonePayload
} from "./lib/api";

const MAX_PROGRESS_EVENTS = 24;

const STEP_LABELS: Record<ResearchStep, string> = {
  skill_routing: "Skill routing",
  plan: "Planning",
  search: "Searching",
  fetch: "Fetching",
  analyze: "Analyzing",
  quality: "Quality check",
  report: "Report generation"
};

export const App = () => {
  const [topic, setTopic] = useState("Research the architecture and positioning of DeerFlow-style agent systems");
  const [language, setLanguage] = useState("zh-CN");
  const [dryRun, setDryRun] = useState(false);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [mcpServers, setMcpServers] = useState<Record<string, McpServerItem>>({});
  const [report, setReport] = useState("");
  const [visibleReport, setVisibleReport] = useState("");
  const [reportPath, setReportPath] = useState<string>();
  const [threadId, setThreadId] = useState<string>();
  const [title, setTitle] = useState<string>();
  const [stats, setStats] = useState<{ sources: number; iterations: number }>();
  const [debug, setDebug] = useState<ResearchDebug>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([]);
  const [activeStep, setActiveStep] = useState<ResearchStep>();
  const [activeMessage, setActiveMessage] = useState<string>();
  const [activeProgress, setActiveProgress] = useState<{ current: number; total: number }>();
  const [isTypingReport, setIsTypingReport] = useState(false);
  const [pendingReportText, setPendingReportText] = useState("");
  const [streamedReport, setStreamedReport] = useState("");
  const visibleReportRef = useRef("");
  const pendingReportRef = useRef("");

  useEffect(() => {
    visibleReportRef.current = visibleReport;
  }, [visibleReport]);

  useEffect(() => {
    pendingReportRef.current = pendingReportText;
  }, [pendingReportText]);

  useEffect(() => {
    const load = async () => {
      try {
        const [skillsResponse, mcpResponse, latestResearch] = await Promise.all([
          api.listSkills(),
          api.getMcpConfig(),
          api.getLatestResearch()
        ]);
        setSkills(skillsResponse.skills);
        setMcpServers(mcpResponse.mcpServers);
        if (latestResearch) {
          setThreadId(latestResearch.threadId);
          setReportPath(latestResearch.reportPath);
          setReport(latestResearch.report);
          setVisibleReport(latestResearch.report);
          setTitle(latestResearch.title);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!isTypingReport) {
      return;
    }

    if (!pendingReportText.length) {
      if (!loading && visibleReport.length >= report.length) {
        setIsTypingReport(false);
      }
      return;
    }

    const chunkSize =
      pendingReportText.length > 1200
        ? 42
        : pendingReportText.length > 600
          ? 24
          : pendingReportText.length > 240
            ? 12
            : 4;
    const delay = visibleReport.length < 160 ? 10 : 16;

    const timer = window.setTimeout(() => {
      const nextSlice = pendingReportText.slice(0, chunkSize);
      startTransition(() => {
        setVisibleReport((current) => current + nextSlice);
        setPendingReportText((current) => current.slice(nextSlice.length));
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isTypingReport, pendingReportText, visibleReport.length, report.length, loading]);

  useEffect(() => {
    if (!isTypingReport) {
      return;
    }

    if (!loading && !pendingReportText.length && visibleReport.length >= streamedReport.length) {
      setIsTypingReport(false);
    }
  }, [isTypingReport, loading, pendingReportText.length, streamedReport.length, visibleReport.length]);

  const handleToggleSkill = async (skillName: string, enabled: boolean) => {
    setSkills((current) =>
      current.map((skill) => (skill.name === skillName ? { ...skill, enabled } : skill))
    );
    try {
      await api.updateSkill(skillName, enabled);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : String(updateError));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(undefined);
    setThreadId(undefined);
    setTitle(`Researching: ${topic}`);
    setReport("");
    setVisibleReport("");
    setPendingReportText("");
    setStreamedReport("");
    visibleReportRef.current = "";
    pendingReportRef.current = "";
    setReportPath(undefined);
    setStats(undefined);
    setDebug(undefined);
    setProgressEvents([]);
    setActiveStep(undefined);
    setActiveMessage("Connecting to the research stream...");
    setActiveProgress(undefined);
    setIsTypingReport(false);
    try {
      let completed = false;
      await streamResearch({
        topic,
        language,
        dryRun
      }, (event) => {
        setProgressEvents((current) => [...current, event].slice(-MAX_PROGRESS_EVENTS));
        if (event.step) {
          setActiveStep(event.step);
        }
        setActiveMessage(event.message);
        setActiveProgress(event.progress);

        if (event.type === "report_chunk") {
          const payload = event.data as ReportChunkPayload | undefined;
          const chunk = payload?.chunk ?? "";
          if (chunk) {
            completed = false;
            setStreamedReport((current) => current + chunk);
            setPendingReportText((current) => current + chunk);
            setIsTypingReport(true);
          }
        }

        if (event.type === "done") {
          const result = event.data as StreamDonePayload;
          completed = true;
          setThreadId(result.threadId);
          setReport(result.report);
          setStreamedReport(result.report);
          setPendingReportText((current) => {
            const alreadyBuffered = visibleReportRef.current.length + pendingReportRef.current.length;
            if (result.report.length <= alreadyBuffered) {
              return current;
            }
            return current + result.report.slice(alreadyBuffered);
          });
          setIsTypingReport(true);
          setReportPath(result.reportPath);
          setTitle(result.title);
          setStats(result.stats);
          setDebug(result.debug);
          setActiveMessage("Research complete.");
          setActiveProgress(undefined);
        }

        if (event.type === "error") {
          setError(event.message);
        }
      });

      if (!completed) {
        throw new Error("Research stream ended before the final result was delivered.");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell">
      <div className="backdrop backdrop-a" />
      <div className="backdrop backdrop-b" />
      <WorkspaceHeader />
      <div className="workspace-grid">
        <ControlPanel
          topic={topic}
          language={language}
          dryRun={dryRun}
          skills={skills}
          mcpServers={mcpServers}
          onTopicChange={setTopic}
          onLanguageChange={setLanguage}
          onDryRunChange={setDryRun}
          onToggleSkill={handleToggleSkill}
          onSubmit={handleSubmit}
          loading={loading}
        />
        <ReportPanel
          threadId={threadId}
          title={title}
          report={visibleReport}
          reportPath={reportPath}
          stats={stats}
          debug={debug}
          loading={loading}
          isTyping={isTypingReport}
          error={error}
          progressEvents={progressEvents}
          activeStepLabel={activeStep ? STEP_LABELS[activeStep] : undefined}
          activeMessage={activeMessage}
          activeProgress={activeProgress}
        />
      </div>
    </main>
  );
};
