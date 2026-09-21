"use client";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { dateTime, shortDate, sourceClass, countLabel } from "../lib/format";
export function SourceDots({ sources }) {
  return (
    <span className="source-dots" aria-label={sources.join(", ")}>
      {sources.map((s) => (
        <span key={s} className={sourceClass(s)} title={s} />
      ))}
    </span>
  );
}
export default function Timeline({ clusters, onSelect }) {
  const start = Math.min(...clusters.map((c) => +new Date(c.startTime)));
  const end = Math.max(...clusters.map((c) => +new Date(c.endTime)));
  const pad = Math.max((end - start) * 0.06, 3600000);
  const min = start - pad,
    span = Math.max(end - start + pad * 2, 7200000);
  const ticks = Array.from({ length: 6 }, (_, i) => min + (span * i) / 5);
  return (
    <div
      className="timeline-scroll"
      tabIndex={0}
      role="region"
      aria-label="Topic activity timeline; scroll horizontally on small screens"
    >
      <div className="timeline-canvas">
        <div className="timeline-axis">
          <span>TOPIC / COVERAGE</span>
          <div>
            {ticks.map((t) => (
              <span key={t}>
                {shortDate(t)}
                <small>
                  {new Date(t).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </span>
            ))}
          </div>
        </div>
        {clusters.map((c, i) => (
          <div key={c.id} className={`timeline-row tone-${i % 6}`}>
            <button className="timeline-label" onClick={() => onSelect(c)}>
              <span className="topic-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <strong>{c.label}</strong>
                <small>
                  <SourceDots sources={c.sources} />
                  {countLabel(c.articleCount, "article")}{" "}
                  <span className="dot-separator">·</span> {c.sources.length}{" "}
                  sources
                </small>
              </span>
            </button>
            <div className="timeline-track">
              <div className="grid-lines">
                {ticks.map((t) => (
                  <i key={t} />
                ))}
              </div>
              <button
                className="timeline-bar"
                style={{
                  left: `${((+new Date(c.startTime) - min) / span) * 100}%`,
                  width: `${Math.max(((+new Date(c.endTime) - new Date(c.startTime)) / span) * 100, 1.8)}%`,
                  "--weight": 0.65 + c.intensity * 0.35,
                }}
                onClick={() => onSelect(c)}
                aria-label={`Open ${c.label}, ${countLabel(c.articleCount, "article")}, ${dateTime(c.startTime)} to ${dateTime(c.endTime)}`}
                title={`${c.label}\n${dateTime(c.startTime)} — ${dateTime(c.endTime)}\n${countLabel(c.articleCount, "article")}`}
              >
                <span className="bar-dot" />
                <span className="bar-text">
                  {countLabel(c.articleCount, "article")}
                </span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        ))}
        <div className="timeline-bottom">
          <Clock3 size={13} /> Times shown in your local timezone{" "}
          <span>
            Each bar follows a story from first report to latest update.
          </span>
        </div>
      </div>
    </div>
  );
}
