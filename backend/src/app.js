import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import { Article, Snapshot, IngestionJob } from "./models.js";

const querySchema = z
  .object({
    source: z.string().max(100).optional(),
    search: z.string().trim().max(120).optional(),
    start: z.iso.datetime({ offset: true }).optional(),
    end: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .refine((q) => !q.start || !q.end || new Date(q.start) <= new Date(q.end), {
    message: "Start date must precede end date",
  });
const fail = (status, message) => Object.assign(new Error(message), { status });
export function createApp({ config, runJob }) {
  const app = express();
  app.set("trust proxy", config.TRUST_PROXY);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        cb(null, !origin || config.origins.includes(origin));
      },
    }),
  );
  app.use(express.json({ limit: "8kb" }));
  const router = express.Router();
  router.get("/health", (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res
      .status(ready ? 200 : 503)
      .json({
        status: ready ? "ok" : "unavailable",
        database: ready ? "connected" : "disconnected",
      });
  });
  router.use((_req, _res, next) =>
    mongoose.connection.readyState === 1
      ? next()
      : next(fail(503, "The database is unavailable. Please retry shortly.")),
  );
  async function filtered(req) {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success)
      throw fail(
        400,
        "Invalid filters. Use source, search, and ISO start/end timestamps.",
      );
    const { source, search, start, end } = parsed.data;
    const snapshot = await Snapshot.findById("timeline").lean();
    let clusters = snapshot?.clusters ?? [];
    // Source/date filters apply to articles as well as counts and bar extents.
    if (source || start || end) {
      const match = { _id: { $in: clusters.flatMap((c) => c.articleIds) } };
      if (source) match.source = source;
      if (start || end)
        match.publishedAt = {
          ...(start && { $gte: new Date(start) }),
          ...(end && { $lte: new Date(end) }),
        };
      const articles = await Article.find(match)
        .select("_id source publishedAt")
        .lean();
      const byId = new Map(articles.map((a) => [String(a._id), a]));
      clusters = clusters.flatMap((c) => {
        const selected = c.articleIds
          .map((id) => byId.get(String(id)))
          .filter(Boolean)
          .sort((a, b) => a.publishedAt - b.publishedAt);
        return selected.length
          ? [
              {
                ...c,
                articleIds: selected.map((a) => a._id),
                articleCount: selected.length,
                sources: [...new Set(selected.map((a) => a.source))],
                startTime: selected[0].publishedAt,
                endTime: selected.at(-1).publishedAt,
              },
            ]
          : [];
      });
    }
    if (search)
      clusters = clusters.filter((c) =>
        `${c.label} ${c.keywords.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      );
    clusters.sort((a, b) => b.endTime - a.endTime);
    return { clusters, snapshot };
  }
  async function list(req, res) {
    const { clusters, snapshot } = await filtered(req);
    res.json({
      data: clusters.map(({ articleIds, _id, ...c }) => ({
        id: _id,
        ...c,
        intensity: Math.min(1, c.articleCount / 12),
      })),
      meta: {
        updatedAt: snapshot?.updatedAt ?? null,
        sources: snapshot?.sources ?? [],
        totalArticles: clusters.reduce((sum, c) => sum + c.articleCount, 0),
        truncated: snapshot?.truncated ?? false,
        mode: "live",
      },
    });
  }
  router.get("/clusters", list);
  router.get("/timeline", list);
  router.get("/clusters/:id", async (req, res) => {
    if (!/^[a-f\d]{24}$/.test(req.params.id))
      throw fail(400, "Invalid cluster ID.");
    const { clusters } = await filtered(req);
    const cluster = clusters.find((c) => c._id === req.params.id);
    if (!cluster)
      throw fail(
        404,
        "This topic is no longer in the current view. Refresh the timeline.",
      );
    const articles = await Article.find({ _id: { $in: cluster.articleIds } })
      .sort({ publishedAt: 1, _id: 1 })
      .lean();
    res.json({ data: { ...cluster, id: cluster._id, articles } });
  });
  router.post(
    "/ingest/trigger",
    rateLimit({
      windowMs: 60000,
      limit: 6,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: {
          message: "Too many refresh requests. Try again in one minute.",
        },
      },
    }),
    async (req, res) => {
      if (req.body && Object.keys(req.body).length)
        throw fail(400, "This endpoint accepts an empty request body.");
      const active = await IngestionJob.findOne({ active: true }).lean();
      if (active)
        return res
          .status(409)
          .json({
            error: { message: "Ingestion is already running." },
            jobId: active._id,
          });
      const recent = await IngestionJob.findOne({
        status: "completed",
        completedAt: { $gt: new Date(Date.now() - config.INGEST_COOLDOWN_MS) },
      }).lean();
      if (recent)
        throw fail(
          429,
          "Data was just refreshed. Please wait a minute before refreshing again.",
        );
      let job;
      try {
        job = await IngestionJob.create({
          status: "queued",
          active: true,
          progress: "Waiting to start",
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        const existing = await IngestionJob.findOne({ active: true }).lean();
        return res
          .status(409)
          .json({
            error: { message: "Ingestion is already running." },
            jobId: existing?._id,
          });
      }
      res.status(202).json({ jobId: job._id, status: "queued" });
      Promise.resolve()
        .then(() => runJob(job))
        .catch(async () => {
          await IngestionJob.updateOne(
            { _id: job._id },
            {
              status: "failed",
              active: false,
              completedAt: new Date(),
              errorMessage: "Unable to start ingestion.",
            },
          ).catch(() => {});
        });
    },
  );
  router.get("/ingest/status/:jobId", async (req, res) => {
    if (!/^[a-f\d]{24}$/.test(req.params.jobId))
      throw fail(400, "Invalid job ID.");
    const job = await IngestionJob.findById(req.params.jobId).lean();
    if (!job) throw fail(404, "Ingestion job not found.");
    res.json({ ...job, jobId: job._id });
  });
  // Both the original assessment paths and /api-prefixed paths are supported.
  app.use("/api", router);
  app.use("/", router);
  app.use((_req, _res, next) => next(fail(404, "Endpoint not found.")));
  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    if (status >= 500) console.error("API request failed:", error.name);
    res
      .status(status)
      .json({
        error: {
          message:
            status === 500
              ? "An unexpected error occurred. Please retry."
              : error.message,
        },
      });
  });
  return app;
}
