"use client";
import { useEffect, useRef, useState } from "react";
import { X, ArrowUpRight, BookOpen, Clock3 } from "lucide-react";
import { api } from "../lib/api";
import { dateTime, safeUrl, sourceClass, countLabel } from "../lib/format";
export default function ClusterDrawer({ cluster, filters, sample, onClose }) {
  const dialog = useRef(null);
  const [detail, setDetail] = useState(sample ? cluster : null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    if (sample) return;
    const controller = new AbortController();
    setError("");
    api
      .detail(cluster.id, filters, controller.signal)
      .then((r) => setDetail(r.data))
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [cluster.id, filters, sample, attempt]);
  return (
    <dialog
      ref={dialog}
      className="drawer"
      aria-labelledby="drawer-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="drawer-content">
        <div className="drawer-top">
          <span className="eyebrow">
            <BookOpen size={14} /> STORY EXPLORER
          </span>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close story explorer"
            autoFocus
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="drawer-title">{cluster.label}</h2>
        <p className="muted">One story. Multiple perspectives.</p>
        <div className="keyword-list">
          {cluster.keywords.map((k) => (
            <span key={k}>{k}</span>
          ))}
        </div>
        <div className="drawer-summary">
          <strong>{countLabel(cluster.articleCount, "article")}</strong>
          <span>{countLabel(cluster.sources.length, "source")}</span>
          <span>
            <Clock3 size={13} /> {dateTime(cluster.startTime)} –{" "}
            {dateTime(cluster.endTime)}
          </span>
        </div>
        {sample && (
          <p className="sample-note">
            Illustrative sample articles. Publisher links open their news
            homepages.
          </p>
        )}
        {error ? (
          <div role="alert" className="state">
            <p>{error}</p>
            <button
              className="button secondary"
              onClick={() => setAttempt((a) => a + 1)}
            >
              Try again
            </button>
          </div>
        ) : !detail ? (
          <div role="status" className="state">
            Loading the story…
          </div>
        ) : (
          <ol className="article-list">
            {detail.articles.map((a) => (
              <li key={a._id}>
                <div className="article-meta">
                  <span className={`source-badge ${sourceClass(a.source)}`}>
                    {a.source}
                  </span>
                  <time dateTime={a.publishedAt}>
                    {dateTime(a.publishedAt)}
                  </time>
                </div>
                <h3>{a.title}</h3>
                <p>
                  {a.summary ||
                    a.content?.slice(0, 320) ||
                    "Read the original report for the complete story."}
                </p>
                {a.dateEstimated && (
                  <small className="muted">
                    Publication time unavailable; collection time shown.
                  </small>
                )}
                {a.extractionMethod === "rss-summary" && (
                  <small className="muted">
                    RSS summary · full text unavailable
                  </small>
                )}
                {safeUrl(a.url) && (
                  <a
                    className="article-link"
                    href={safeUrl(a.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {sample ? "Visit publisher" : "Read original article"}{" "}
                    <ArrowUpRight size={15} />
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </dialog>
  );
}
