"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Radio,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Layers3,
  Newspaper,
  Globe2,
  Clock3,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import Timeline from "./Timeline";
import TopicCard from "./TopicCard";
import ClusterDrawer from "./ClusterDrawer";
import useNewsDashboard, { emptyFilters } from "../hooks/useNewsDashboard";
import { shortDate } from "../lib/format";

export default function Dashboard() {
  const {
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
  } = useNewsDashboard();
  const [about, setAbout] = useState(false);
  const aboutRef = useRef(null);
  useEffect(() => {
    if (about) aboutRef.current?.showModal();
  }, [about]);
  const stats = useMemo(
    () => [
      {
        label: "Active topics",
        value: clusters.length,
        icon: Layers3,
        note: "Stories taking shape",
        style: "purple",
      },
      {
        label: "Articles collected",
        value: result?.meta.totalArticles ?? 0,
        icon: Newspaper,
        note: "Connected by context",
        style: "blue",
      },
      {
        label: "News sources",
        value: new Set(clusters.flatMap((c) => c.sources)).size,
        icon: Globe2,
        note: "Different perspectives",
        style: "orange",
      },
      {
        label: "Latest update",
        value: result?.meta.updatedAt
          ? new Date(result.meta.updatedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
        icon: Clock3,
        note: result?.meta.updatedAt
          ? shortDate(result.meta.updatedAt)
          : "Ready when you are",
        style: "green",
      },
    ],
    [clusters, result],
  );
  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label="News Pulse home">
          <span className="brand-mark">
            <Activity size={23} strokeWidth={2.3} />
          </span>
          news<span className="brand-light">pulse</span>
          <span className="brand-period">.</span>
        </a>
        <nav aria-label="Main navigation">
          <a className="nav-active" href="#timeline">
            Overview
          </a>
          <button onClick={() => setAbout(true)}>
            How it works <ArrowUpRight size={13} />
          </button>
        </nav>
        <span className={`status-pill ${mode === "sample" ? "sample" : ""}`}>
          <span />
          {mode === "sample" ? "Sample workspace" : "Live news workspace"}
        </span>
      </header>
      <main id="main-content">
        <section className="hero">
          <div>
            <div className="eyebrow">
              <span className="tiny-line" /> THE WORLD, IN CONTEXT
            </div>
            <h1>
              Follow the <span>bigger story.</span>
            </h1>
            <p>
              Beyond the headlines. Discover how stories develop across sources
              and time.
            </p>
          </div>
          <div className="hero-actions">
            <button
              className="button primary"
              onClick={refresh}
              disabled={busy || mode === "sample"}
              title={
                mode === "sample"
                  ? "Switch to live data to collect real news"
                  : "Fetch new articles and update topics"
              }
            >
              <RefreshCw size={16} className={busy ? "spin" : ""} />
              {busy ? "Refreshing…" : "Refresh Data"}
            </button>
            <span className="last-updated">
              {mode === "sample"
                ? "Illustrative data · explore freely"
                : "Live RSS feeds · intelligently grouped"}
            </span>
          </div>
        </section>
        <div className="mode-banner">
          <span>
            {mode === "sample" ? <Sparkles size={15} /> : <Radio size={15} />}
            <strong>
              {mode === "sample"
                ? "You’re exploring sample data."
                : "A wider view of the news."}
            </strong>
            <span>
              {mode === "sample"
                ? "These stories demonstrate the experience."
                : "Independent reporting, connected in one place."}
            </span>
          </span>
          <button onClick={switchMode}>
            {mode === "sample" ? "Switch to live data" : "Explore sample data"}
            <ArrowRight size={14} />
          </button>
        </div>
        {busy && (
          <div role="status" className="notice">
            <RefreshCw size={16} className="spin" />
            {progress}
          </div>
        )}
        {toast && (
          <div
            role={toast.type === "error" ? "alert" : "status"}
            className={`notice ${toast.type}`}
          >
            {toast.type === "error" ? (
              <AlertCircle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
            <span>{toast.text}</span>
            <button
              className="icon-button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <section className="stats" aria-label="News overview">
          {stats.map(({ label, value, icon: Icon, note, style }) => (
            <article className="stat-card" key={label}>
              <div>
                <span>{label}</span>
                <span className={`stat-icon ${style}`}>
                  <Icon size={17} />
                </span>
              </div>
              <strong>{loading ? "—" : value}</strong>
              <small>{note}</small>
            </article>
          ))}
        </section>
        <section className="workspace" id="timeline">
          <div className="section-heading">
            <div>
              <h2>
                <span className="section-square" />
                The news timeline{" "}
                <span className="count-badge">{clusters.length} topics</span>
              </h2>
              <p>See when stories started, evolved, and connected.</p>
            </div>
            <label className="auto-refresh">
              <input
                type="checkbox"
                checked={auto}
                onChange={(e) => setAuto(e.target.checked)}
                disabled={mode === "sample"}
              />
              <span className="switch" />
              Auto-sync <span className="muted">60s</span>
            </label>
          </div>
          <div className="filter-bar">
            <label className="search-input">
              <Search size={17} />
              <input
                aria-label="Search topics"
                placeholder="Search topics or keywords…"
                value={filters.search}
                onChange={(e) => changeFilter("search", e.target.value)}
              />
              {filters.search && (
                <button
                  aria-label="Clear search"
                  className="icon-button"
                  onClick={() => changeFilter("search", "")}
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <label className="source-select">
              <SlidersHorizontal size={15} />
              <select
                aria-label="Filter by source"
                value={filters.source}
                onChange={(e) => changeFilter("source", e.target.value)}
              >
                <option value="">All sources</option>
                {result?.meta.sources.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
            <div className="date-filters">
              <input
                type="date"
                aria-label="Start date"
                value={filters.start}
                onChange={(e) => changeFilter("start", e.target.value)}
              />
              <span>–</span>
              <input
                type="date"
                aria-label="End date"
                value={filters.end}
                onChange={(e) => changeFilter("end", e.target.value)}
              />
            </div>
            <button
              className="clear-filter"
              disabled={!filterActive}
              onClick={() => {
                setFilters(emptyFilters);
                setLimit(12);
              }}
            >
              Clear
            </button>
          </div>
          <div className="view-toolbar">
            <div className="view-tabs" role="group" aria-label="View style">
              <button
                className={view === "timeline" ? "selected" : ""}
                aria-pressed={view === "timeline"}
                onClick={() => setView("timeline")}
              >
                <Activity size={14} />
                Timeline
              </button>
              <button
                className={view === "topics" ? "selected" : ""}
                aria-pressed={view === "topics"}
                onClick={() => setView("topics")}
              >
                <Layers3 size={14} />
                Topics
              </button>
            </div>
            <span className="legend">
              <i className="bbc" />
              BBC News <i className="guardian" />
              The Guardian <i className="jazeera" />
              Al Jazeera
            </span>
          </div>
          {view === "timeline" && (
            <div className="mobile-hint">
              Swipe across the timeline to explore story activity →
            </div>
          )}
          {invalidDates ? (
            <div className="state" role="alert">
              <AlertCircle />
              <h3>Check your date range</h3>
              <p>The start date must be on or before the end date.</p>
            </div>
          ) : loading ? (
            <div className="loading-state" role="status">
              <span className="sr-only">Loading timeline</span>
              {warming && (
                <p className="warming">
                  The news service is waking up. First loads can take about a
                  minute.
                </p>
              )}
              {Array.from({ length: 6 }, (_, i) => (
                <div className="skeleton-row" key={i}>
                  <span />
                  <i style={{ width: `${35 + i * 7}%` }} />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="state" role="alert">
              <AlertCircle />
              <h3>A brief pause in the news</h3>
              <p>{error}</p>
              <div>
                <button
                  className="button primary"
                  onClick={() => setRevision((r) => r + 1)}
                >
                  Try again
                </button>
                <button className="button secondary" onClick={switchMode}>
                  Explore sample data
                </button>
              </div>
            </div>
          ) : !clusters.length ? (
            <div className="state">
              <Search />
              <h3>
                {filterActive
                  ? "No stories match these filters"
                  : "Your first stories are one refresh away"}
              </h3>
              <p>
                {filterActive
                  ? "Try another keyword, source, or date range."
                  : "Collect the latest reporting and see the connections emerge."}
              </p>
              <button
                className="button primary"
                disabled={busy}
                onClick={
                  filterActive ? () => setFilters(emptyFilters) : refresh
                }
              >
                {filterActive ? "Clear filters" : "Collect live news"}
              </button>
            </div>
          ) : view === "timeline" ? (
            <Timeline
              clusters={clusters.slice(0, limit)}
              onSelect={setSelection}
            />
          ) : (
            <div className="topic-grid">
              {clusters.slice(0, limit).map((c, i) => (
                <TopicCard
                  key={c.id}
                  cluster={c}
                  index={i}
                  onSelect={setSelection}
                />
              ))}
            </div>
          )}
          {!loading && !error && clusters.length > limit && (
            <div className="load-more">
              <span>
                Showing {limit} of {clusters.length} topics
              </span>
              <button
                className="button secondary"
                onClick={() => setLimit((n) => n + 12)}
              >
                Show more topics <ChevronDown size={14} />
              </button>
            </div>
          )}
          {result?.meta.truncated && (
            <p className="sample-note">
              Showing the latest 1,000 articles within the configured collection
              window.
            </p>
          )}
        </section>
        {!loading && !error && clusters.length > 0 && (
          <section className="developing">
            <div className="section-heading">
              <div>
                <span className="eyebrow">MORE PERSPECTIVES, MORE CONTEXT</span>
                <h2>Stories worth a closer look</h2>
              </div>
              <span className="muted">
                Most covered topics <ArrowUpRight size={14} />
              </span>
            </div>
            <div className="featured-grid">
              {[...clusters]
                .sort((a, b) => b.articleCount - a.articleCount)
                .slice(0, 3)
                .map((c, i) => (
                  <TopicCard
                    key={c.id}
                    cluster={c}
                    index={i}
                    onSelect={setSelection}
                  />
                ))}
            </div>
          </section>
        )}
        <footer>
          <a className="footer-brand" href="#">
            <Activity size={18} />
            news pulse
          </a>
          <p>A little clarity in a world of headlines.</p>
          <span>
            {mode === "sample" ? "Sample data" : "Powered by public RSS feeds"}
            <span className="dot-separator">·</span>Built for perspective
          </span>
        </footer>
      </main>
      {selection && (
        <ClusterDrawer
          key={selection.id}
          cluster={selection}
          filters={filters}
          sample={mode === "sample"}
          onClose={() => setSelection(null)}
        />
      )}
      {about && (
        <dialog
          ref={aboutRef}
          className="about-dialog"
          aria-labelledby="about-title"
          onCancel={() => setAbout(false)}
        >
          <button
            className="icon-button about-close"
            aria-label="Close explanation"
            onClick={() => setAbout(false)}
          >
            <X />
          </button>
          <span className="eyebrow">FROM HEADLINE TO BIGGER PICTURE</span>
          <h2 id="about-title">How News Pulse works</h2>
          <ol>
            <li>
              <strong>Collect.</strong> Python reads BBC News, The Guardian, and
              Al Jazeera RSS feeds and extracts article text.
            </li>
            <li>
              <strong>Connect.</strong> TF-IDF and cosine similarity group
              related headlines and summaries. Each topic gets an automatic
              label.
            </li>
            <li>
              <strong>Explore.</strong> Every bar spans the earliest to the
              latest article. Open a topic to compare sources in chronological
              order.
            </li>
          </ol>
          <p className="muted">
            Grouping is automatic and can miss connections or combine loosely
            related stories. Original reporting belongs to its publishers.
          </p>
        </dialog>
      )}
    </>
  );
}
