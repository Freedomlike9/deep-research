import { startTransition, useEffect, useRef, useState } from "react";
import { ControlPanel } from "./components/ControlPanel";
import { ReportPanel } from "./components/ReportPanel";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import {
  api,
  type HistoryRecord,
  type ReportChunkPayload,
  streamResearch,
  type ProgressEvent,
  type ResearchStep,
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
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("zh-CN");
  const [report, setReport] = useState("");
  const [visibleReport, setVisibleReport] = useState("");
  const [title, setTitle] = useState<string>();
  const [stats, setStats] = useState<{ sources: number; iterations: number }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([]);
  const [activeStep, setActiveStep] = useState<ResearchStep>();
  const [activeMessage, setActiveMessage] = useState<string>();
  const [activeProgress, setActiveProgress] = useState<{ current: number; total: number }>();
  const [isTypingReport, setIsTypingReport] = useState(false);
  const [pendingReportText, setPendingReportText] = useState("");
  const [streamedReport, setStreamedReport] = useState("");
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>();
  const visibleReportRef = useRef("");
  const pendingReportRef = useRef("");
  const streamedReportRef = useRef("");

  useEffect(() => {
    visibleReportRef.current = visibleReport;
  }, [visibleReport]);

  useEffect(() => {
    pendingReportRef.current = pendingReportText;
  }, [pendingReportText]);

  useEffect(() => {
    streamedReportRef.current = streamedReport;
  }, [streamedReport]);

  const refreshHistory = async () => {
    try {
      const historyResponse = await api.listResearchHistory();
      setHistoryRecords(historyResponse.records);
    } catch {
      // 历史加载失败不影响主功能
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const latestResearch = await api.getLatestResearch();
        if (latestResearch) {
          setSelectedThreadId(latestResearch.threadId);
          setReport(latestResearch.report);
          setVisibleReport(latestResearch.report);
          setTitle(latestResearch.title);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      }
      await refreshHistory();
    };
    void load();
  }, []);

  // Typewriter effect
  useEffect(() => {
    if (!isTypingReport) return;

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
    if (!isTypingReport) return;
    if (!loading && !pendingReportText.length && visibleReport.length >= streamedReport.length) {
      setIsTypingReport(false);
    }
  }, [isTypingReport, loading, pendingReportText.length, streamedReport.length, visibleReport.length]);

  const handleDeleteHistory = async (id: string) => {
    try {
      await api.deleteResearch(id);
      setHistoryRecords((current) => current.filter((r) => r.threadId !== id));
      if (id === selectedThreadId) {
        setSelectedThreadId(undefined);
        setTitle(undefined);
        setReport("");
        setVisibleReport("");
        setStats(undefined);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    }
  };

  const handleSelectHistory = async (id: string) => {
    if (loading) return;
    try {
      const detail = await api.getResearchByThreadId(id);
      setSelectedThreadId(detail.threadId);
      setTitle(detail.title);
      setReport(detail.report);
      setVisibleReport(detail.report);
      setStats(detail.stats);
      setProgressEvents([]);
      setActiveStep(undefined);
      setActiveMessage(undefined);
      setActiveProgress(undefined);
      setError(undefined);
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : String(selectError));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(undefined);
    setSelectedThreadId(undefined);
    setTitle(`Researching: ${topic}`);
    setReport("");
    setVisibleReport("");
    setPendingReportText("");
    setStreamedReport("");
    visibleReportRef.current = "";
    pendingReportRef.current = "";
    streamedReportRef.current = "";
    setStats(undefined);
    setProgressEvents([]);
    setActiveStep(undefined);
    setActiveMessage("Connecting to the research stream...");
    setActiveProgress(undefined);
    setIsTypingReport(false);

    try {
      let completed = false;
      await streamResearch({ topic, language }, (event) => {
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
            setStreamedReport((current) => current + chunk);
            setPendingReportText((current) => current + chunk);
            setIsTypingReport(true);
          }
        }

        if (event.type === "done") {
          const result = event.data as StreamDonePayload;
          completed = true;
          setSelectedThreadId(result.threadId);
          setTitle(result.title);
          setStats(result.stats);
          setActiveMessage("Research complete.");
          setActiveProgress(undefined);

          // Use the accumulated streamedReport as the authoritative report
          // text. The done event no longer carries the full report — it was
          // already delivered via report_chunk events.
          const finalReport = streamedReportRef.current;
          setReport(finalReport);

          // If there is any unseen text that the typewriter hasn't queued yet,
          // push it into the pending buffer so nothing is lost.
          const alreadyBuffered = visibleReportRef.current.length + pendingReportRef.current.length;
          if (finalReport.length > alreadyBuffered) {
            setPendingReportText((current) => current + finalReport.slice(alreadyBuffered));
          }
          setIsTypingReport(true);

          void refreshHistory();
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
          historyRecords={historyRecords}
          selectedThreadId={selectedThreadId}
          onTopicChange={setTopic}
          onLanguageChange={setLanguage}
          onSelectHistory={handleSelectHistory}
          onDeleteHistory={handleDeleteHistory}
          onSubmit={handleSubmit}
          loading={loading}
        />
        <ReportPanel
          title={title}
          report={visibleReport}
          stats={stats}
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
