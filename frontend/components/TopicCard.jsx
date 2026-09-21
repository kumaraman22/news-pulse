import { ArrowUpRight } from "lucide-react";
import { SourceDots } from "./Timeline";
import { shortDate, countLabel } from "../lib/format";
export default function TopicCard({ cluster: c, index, onSelect }) {
  return (
    <button
      className={`topic-card tone-${index % 6}`}
      onClick={() => onSelect(c)}
    >
      <div>
        <span className="topic-category">{c.keywords[0] || "In the news"}</span>
        <ArrowUpRight size={17} />
      </div>
      <h3>{c.label}</h3>
      <p>
        {countLabel(c.articleCount, "article")}{" "}
        <span className="dot-separator">·</span>{" "}
        {countLabel(c.sources.length, "perspective")}
      </p>
      <div className="topic-card-footer">
        <SourceDots sources={c.sources} />
        <span>
          {shortDate(c.startTime)} – {shortDate(c.endTime)}
        </span>
        <span className="sr-only">View story</span>
      </div>
    </button>
  );
}
