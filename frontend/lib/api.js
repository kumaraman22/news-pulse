const base = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
).replace(/\/$/, "");
export async function request(path, options = {}) {
  const timeout = AbortSignal.timeout(70000);
  const response = await fetch(`${base}${path}`, {
    ...options,
    signal: options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(
      new Error(
        body.error?.message || "The news service is unavailable. Please retry.",
      ),
      { status: response.status, jobId: body.jobId },
    );
  return body;
}
export function queryString(filters) {
  const query = new URLSearchParams();
  if (filters.source) query.set("source", filters.source);
  if (filters.search) query.set("search", filters.search);
  if (filters.start)
    query.set("start", new Date(`${filters.start}T00:00:00`).toISOString());
  if (filters.end)
    query.set("end", new Date(`${filters.end}T23:59:59.999`).toISOString());
  return query.toString();
}
export const api = {
  timeline: (filters, signal) =>
    request(`/timeline?${queryString(filters)}`, { signal }),
  detail: (id, filters, signal) =>
    request(`/clusters/${id}?${queryString(filters)}`, { signal }),
  trigger: () => request("/ingest/trigger", { method: "POST", body: "{}" }),
  status: (id) => request(`/ingest/status/${id}`),
};
