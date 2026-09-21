"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { sampleData, filterSample } from "../lib/sample";
export const emptyFilters = { search: "", source: "", start: "", end: "" };
export default function useNewsDashboard() {
  const [mode, setMode] = useState("live");
  const [sample, setSample] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selection, setSelection] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [progress, setProgress] = useState("");
  const [toast, setToast] = useState(null);
  const [revision, setRevision] = useState(0);
  const [auto, setAuto] = useState(false);
  const [view, setView] = useState("timeline");
  const [limit, setLimit] = useState(12);
  const [warming, setWarming] = useState(false);
  const busy = !!jobId || triggering;
  const invalidDates =
    filters.start && filters.end && filters.start > filters.end;
  useEffect(() => {
    setSample(sampleData());
    if (new URLSearchParams(location.search).get("demo") === "1")
      setMode("sample");
    const saved = sessionStorage.getItem("news-pulse-job");
    if (saved) setJobId(saved);
  }, []);
  useEffect(() => {
    if (invalidDates) {
      setLoading(false);
      return;
    }
    if (mode === "sample" && sample) {
      setResult(filterSample(sample, filters));
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setWarming(false);
    const slow = setTimeout(() => setWarming(true), 5000);
    const timer = setTimeout(() => {
      api
        .timeline(filters, controller.signal)
        .then(setResult)
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(
              e.message === "Failed to fetch"
                ? "We couldn’t reach the news service. It may be waking up. Please retry in a moment."
                : e.message,
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
            setWarming(false);
            clearTimeout(slow);
          }
        });
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
      clearTimeout(slow);
    };
  }, [filters, mode, sample, revision, invalidDates]);
  useEffect(() => {
    if (!auto || mode === "sample" || busy) return;
    const timer = setInterval(() => {
      if (!document.hidden) setRevision((r) => r + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, [auto, mode, busy]);
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false,
      timer;
    sessionStorage.setItem("news-pulse-job", jobId);
    async function poll() {
      try {
        const job = await api.status(jobId);
        if (cancelled) return;
        setProgress(job.progress || "Collecting and grouping articles…");
        if (job.status === "completed" || job.status === "failed") {
          setJobId(null);
          sessionStorage.removeItem("news-pulse-job");
          setToast({
            type: job.status === "failed" ? "error" : "success",
            text:
              job.status === "failed"
                ? job.errorMessage
                : `Timeline updated. ${job.articlesAdded} new articles collected.${job.warnings?.length ? " " + job.warnings.join(" ") : ""}`,
          });
          if (job.status === "completed") setRevision((r) => r + 1);
          return;
        }
      } catch (e) {
        if (cancelled) return;
        if (e.status === 404 || e.status === 400) {
          setJobId(null);
          sessionStorage.removeItem("news-pulse-job");
          setToast({ type: "error", text: e.message });
          return;
        }
        setProgress(
          "Connection interrupted. Reconnecting to your ingestion job…",
        );
      }
      if (!cancelled) timer = setTimeout(poll, 3000);
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId]);
  async function refresh() {
    setTriggering(true);
    setToast(null);
    setProgress("Starting news collection…");
    try {
      const job = await api.trigger();
      setJobId(job.jobId);
    } catch (e) {
      if (e.status === 409 && e.jobId) setJobId(e.jobId);
      else setToast({ type: "error", text: e.message });
    } finally {
      setTriggering(false);
    }
  }
  const switchMode = useCallback(() => {
    setMode((m) => (m === "live" ? "sample" : "live"));
    setSelection(null);
    setFilters(emptyFilters);
    setLimit(12);
  }, []);
  const clusters = result?.data ?? [];
  const filterActive = Object.values(filters).some(Boolean);
  const changeFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setLimit(12);
  };
  return {
    mode,
    filters,
    setFilters,
    result,
    loading,
    error,
    selection,
    setSelection,
    progress,
    toast,
    setToast,
    setRevision,
    auto,
    setAuto,
    view,
    setView,
    limit,
    setLimit,
    warming,
    busy,
    invalidDates,
    refresh,
    switchMode,
    clusters,
    filterActive,
    changeFilter,
  };
}
