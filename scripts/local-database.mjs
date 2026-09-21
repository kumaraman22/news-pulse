import { MongoMemoryServer } from "mongodb-memory-server";
import { mkdir } from "node:fs/promises";
import path from "node:path";
const dbPath = path.resolve(".local/mongo");
await mkdir(dbPath, { recursive: true });
const db = await MongoMemoryServer.create({
  instance: {
    port: 27017,
    dbPath,
    storageEngine: "wiredTiger",
    dbName: "news_pulse",
  },
});
console.log(
  "Development MongoDB ready at mongodb://127.0.0.1:27017/news_pulse (data stored in .local/mongo).",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await db.stop();
    process.exit(0);
  });
