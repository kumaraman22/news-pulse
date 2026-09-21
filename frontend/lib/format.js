export const dateTime = (value) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
export const shortDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
export const sourceClass = (source) =>
  source === "BBC News"
    ? "bbc"
    : source === "The Guardian"
      ? "guardian"
      : "jazeera";
export const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

export const countLabel = (count, noun) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;
