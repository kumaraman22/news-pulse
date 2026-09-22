import mongoose from "mongoose";
import { readConfig } from "./config.js";
import { createApp } from "./app.js";
import { createJobRunner, recoverStaleJobs } from "./jobs.js";
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
    // Worker heartbeats survive API restarts; a dead worker releases its lock promptly.
    const recover = () => recoverStaleJobs(config).catch(() => {});
    await recover();
    setInterval(recover, 15000).unref();
    console.log("MongoDB connected; ingestion worker ready");
  } catch (error) {
    const reason = error.code === 18 || error.code === 8000
      ? "authentication failed; verify the Atlas username and password"
      : error.code === 13
        ? "database permissions denied; verify the database user role"
        : error.name === "MongooseServerSelectionError"
          ? "server selection failed; verify Atlas network access and cluster availability"
          : "connection or index initialization failed";
    // Never log the driver message or URI: either can contain credentials.
    console.error(`MongoDB unavailable (${reason}); retrying in 10 seconds.`);
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
