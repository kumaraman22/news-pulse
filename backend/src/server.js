import mongoose from "mongoose";
import { readConfig } from "./config.js";
import { createApp } from "./app.js";
import { createJobRunner } from "./jobs.js";
import { Article, Snapshot, IngestionJob } from "./models.js";
const config = readConfig();
mongoose.set("bufferCommands", false);
const app = createApp({ config, runJob: createJobRunner(config) });
const server = app.listen(config.PORT, () =>
  console.log(`News Pulse API listening on port ${config.PORT}`),
);
async function connect() {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      dbName: config.MONGODB_DB,
      serverSelectionTimeoutMS: 5000,
    });
    await Promise.all([Article.init(), Snapshot.init(), IngestionJob.init()]);
    // A persisted lease expires after the maximum job duration, including after restarts.
    const recover = () =>
      IngestionJob.updateMany(
        {
          active: true,
          createdAt: {
            $lt: new Date(Date.now() - config.INGEST_TIMEOUT_MS - 30000),
          },
        },
        {
          status: "failed",
          active: false,
          completedAt: new Date(),
          errorMessage: "The worker stopped before completion. Please retry.",
        },
      ).catch(() => {});
    await recover();
    setInterval(recover, 30000).unref();
    console.log("MongoDB connected; ingestion worker ready");
  } catch {
    console.error("MongoDB unavailable; retrying in 10 seconds.");
    setTimeout(connect, 10000).unref();
  }
}
connect();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    }),
  );
