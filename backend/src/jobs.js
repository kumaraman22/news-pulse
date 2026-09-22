import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { IngestionJob } from "./models.js";
export async function recoverStaleJobs(config, now = new Date()) {
  const stale = new Date(now.getTime() - 90000);
  return IngestionJob.updateMany(
    {
      active: true,
      $or: [
        { heartbeatAt: { $lt: stale } },
        { heartbeatAt: { $exists: false }, createdAt: { $lt: stale } },
        {
          createdAt: {
            $lt: new Date(now.getTime() - config.INGEST_TIMEOUT_MS - 30000),
          },
        },
      ],
    },
    {
      status: "failed",
      active: false,
      completedAt: now,
      errorMessage:
        "The ingestion worker stopped responding. Please refresh again.",
    },
  );
}
export function createJobRunner(config) {
  return async (job) => {
    await IngestionJob.updateOne(
      { _id: job._id },
      {
        status: "running",
        startedAt: new Date(),
        heartbeatAt: new Date(),
        progress: "Collecting articles from RSS feeds",
      },
    );
    const child = spawn(
      config.PYTHON_BIN,
      [
        fileURLToPath(new URL("../../pipeline/main.py", import.meta.url)),
        "--job-id",
        String(job._id),
      ],
      {
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          MONGODB_URI: config.MONGODB_URI,
          MONGODB_DB: config.MONGODB_DB,
          SIMILARITY_THRESHOLD: String(config.SIMILARITY_THRESHOLD),
          MAX_ARTICLES_PER_FEED: String(config.MAX_ARTICLES_PER_FEED),
          CLUSTER_WINDOW_DAYS: String(config.CLUSTER_WINDOW_DAYS),
          HTTP_TIMEOUT_SECONDS: String(config.HTTP_TIMEOUT_SECONDS),
          PYTHONUTF8: "1",
        },
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    // Do not forward third-party responses or database connection strings into logs.
    child.stderr.on("data", () => {});
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, config.INGEST_TIMEOUT_MS);
    timer.unref();
    let settled = false;
    async function finish(message) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await IngestionJob.updateOne(
        { _id: job._id, active: true },
        {
          status: "failed",
          active: false,
          completedAt: new Date(),
          errorMessage: message,
        },
      ).catch(() => console.error("Could not finalize ingestion job"));
    }
    child.on("error", () =>
      finish(
        "Python could not start. Check PYTHON_BIN and pipeline dependencies.",
      ),
    );
    child.on("close", (code) =>
      finish(
        timedOut
          ? "Ingestion exceeded its time limit. Please retry."
          : `Pipeline exited without completing the job (exit ${code}).`,
      ),
    );
  };
}
