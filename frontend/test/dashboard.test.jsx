import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Dashboard from "../components/Dashboard";
import { sampleData, filterSample } from "../lib/sample";
import { safeUrl } from "../lib/format";
vi.mock("../lib/api", () => ({
  api: {
    timeline: vi.fn(),
    trigger: vi.fn(),
    status: vi.fn(),
    detail: vi.fn(),
  },
}));
import { api } from "../lib/api";
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});
describe("dashboard states", () => {
  test("shows accessible loading state", () => {
    api.timeline.mockImplementation(() => new Promise(() => {}));
    render(<Dashboard />);
    expect(screen.getByText("Loading timeline")).toBeInTheDocument();
  });
  test("shows error and recovery action", async () => {
    api.timeline.mockRejectedValue(new Error("Service unavailable"));
    render(<Dashboard />);
    expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
  test("renders successful timeline and filters", async () => {
    api.timeline.mockResolvedValue(sampleData());
    render(<Dashboard />);
    expect(
      await screen.findByRole("region", { name: /Topic activity/ }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter by source"), {
      target: { value: "BBC News" },
    });
    await waitFor(() =>
      expect(api.timeline).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: "BBC News" }),
        expect.any(AbortSignal),
      ),
    );
  });
  test("triggers and polls ingestion then reloads timeline", async () => {
    api.timeline.mockResolvedValue({
      data: [],
      meta: { sources: [], totalArticles: 0 },
    });
    api.trigger.mockResolvedValue({ jobId: "job" });
    api.status.mockResolvedValue({
      status: "completed",
      articlesAdded: 5,
      warnings: [],
    });
    render(<Dashboard />);
    await screen.findByText("Your first stories are one refresh away");
    fireEvent.click(screen.getByRole("button", { name: "Refresh Data" }));
    expect(
      await screen.findByText(/5 new articles collected/),
    ).toBeInTheDocument();
    await waitFor(() => expect(api.timeline).toHaveBeenCalledTimes(2));
  });
});
test("sample source filtering updates counts and safe links reject script schemes", () => {
  const sample = sampleData();
  const filtered = filterSample(sample, { source: "BBC News" });
  expect(filtered.meta.totalArticles).toBeLessThan(sample.meta.totalArticles);
  expect(filtered.data.every((c) => c.sources.length === 1)).toBe(true);
  expect(safeUrl("javascript:alert(1)")).toBe(null);
});
