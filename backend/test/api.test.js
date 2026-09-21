import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Article, Snapshot, IngestionJob } from "../src/models.js";
import { readConfig } from "../src/config.js";
let db, app;
const clusterId = "1234567890abcdef12345678";
before(async () => {
  db = await MongoMemoryServer.create();
  await mongoose.connect(db.getUri());
  await Promise.all([Article.init(), IngestionJob.init()]);
  app = createApp({
    config: readConfig({ INGEST_COOLDOWN_MS: "0" }),
    runJob: async () => {},
  });
});
after(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
beforeEach(async () => {
  await Promise.all([
    Article.deleteMany({}),
    Snapshot.deleteMany({}),
    IngestionJob.deleteMany({}),
  ]);
  const articles = await Article.create([
    {
      title: "Spacecraft landing",
      url: "https://example.com/a",
      contentHash: "a",
      source: "BBC News",
      publishedAt: new Date("2026-09-20T08:00:00Z"),
    },
    {
      title: "Moon landing",
      url: "https://example.com/b",
      contentHash: "b",
      source: "The Guardian",
      publishedAt: new Date("2026-09-21T10:00:00Z"),
    },
  ]);
  await Snapshot.create({
    _id: "timeline",
    sources: ["BBC News", "The Guardian"],
    updatedAt: new Date(),
    clusters: [
      {
        _id: clusterId,
        label: "Lunar Mission",
        keywords: ["lunar"],
        articleIds: articles.map((a) => a._id),
        articleCount: 2,
        sources: ["BBC News", "The Guardian"],
        startTime: articles[0].publishedAt,
        endTime: articles[1].publishedAt,
      },
    ],
  });
});
test("timeline and assessment alias return chart-ready data", async () => {
  for (const url of ["/api/timeline", "/timeline", "/clusters"]) {
    const res = await request(app).get(url).expect(200);
    assert.equal(res.body.data[0].articleCount, 2);
    assert.ok(res.body.data[0].intensity);
  }
});
test("source filters recompute counts, extents, and detail articles", async () => {
  const res = await request(app)
    .get("/api/clusters?source=BBC%20News")
    .expect(200);
  assert.equal(res.body.data[0].articleCount, 1);
  assert.equal(res.body.data[0].startTime, res.body.data[0].endTime);
  const detail = await request(app)
    .get(`/api/clusters/${clusterId}?source=BBC%20News`)
    .expect(200);
  assert.equal(detail.body.data.articles.length, 1);
});
test("details are chronological and not found/invalid IDs differ", async () => {
  const res = await request(app).get(`/api/clusters/${clusterId}`).expect(200);
  assert.equal(res.body.data.articles[0].source, "BBC News");
  await request(app).get("/api/clusters/invalid").expect(400);
  await request(app).get("/api/clusters/ffffffffffffffffffffffff").expect(404);
});
test("invalid filters and inverted date ranges are rejected", async () => {
  await request(app).get("/api/timeline?start=nonsense").expect(400);
  await request(app).get("/api/timeline?source[$ne]=x").expect(400);
  await request(app)
    .get("/api/timeline?start=2026-09-21T00:00:00Z&end=2026-09-20T00:00:00Z")
    .expect(400);
  const res = await request(app)
    .get("/api/timeline?search=unrelated")
    .expect(200);
  assert.deepEqual(res.body.data, []);
});
test("ingestion returns a job and prevents concurrent jobs", async () => {
  const res = await request(app)
    .post("/api/ingest/trigger")
    .send({})
    .expect(202);
  const conflict = await request(app)
    .post("/api/ingest/trigger")
    .send({})
    .expect(409);
  assert.equal(conflict.body.jobId, res.body.jobId);
  const status = await request(app)
    .get(`/api/ingest/status/${res.body.jobId}`)
    .expect(200);
  assert.equal(status.body.status, "queued");
  await request(app).get("/api/ingest/status/bad").expect(400);
  await request(app)
    .get("/api/ingest/status/ffffffffffffffffffffffff")
    .expect(404);
});
test("unique indexes prevent duplicates", async () => {
  await assert.rejects(
    Article.create({ url: "https://example.com/a", contentHash: "other" }),
    { code: 11000 },
  );
});
test("health and unknown routes", async () => {
  await request(app).get("/api/health").expect(200);
  await request(app).get("/api/missing").expect(404);
});
test("server errors do not leak internal details", async (t) => {
  t.mock.method(Snapshot, "findById", () => {
    throw new Error("private database detail");
  });
  const res = await request(app).get("/api/timeline").expect(500);
  assert.equal(
    res.body.error.message,
    "An unexpected error occurred. Please retry.",
  );
});
test("date filters compare instants with different timezone offsets", async () => {
  const res = await request(app)
    .get("/api/timeline")
    .query({ start: "2026-09-21T12:00:00+05:30", end: "2026-09-21T10:00:00Z" })
    .expect(200);
  assert.equal(res.body.data[0].articleCount, 1);
});
