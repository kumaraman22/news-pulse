import { test } from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "../src/config.js";
test("configuration validates numeric parameters and exact origins", () => {
  assert.throws(() => readConfig({ SIMILARITY_THRESHOLD: "2" }));
  assert.throws(() => readConfig({ MAX_ARTICLES_PER_FEED: "0" }));
  assert.throws(() =>
    readConfig({ FRONTEND_ORIGIN: "https://example.com/some-path" }),
  );
  assert.throws(() => readConfig({ NODE_ENV: "production" }));
  assert.deepEqual(
    readConfig({ FRONTEND_ORIGIN: "https://example.com,http://localhost:3001" })
      .origins,
    ["https://example.com", "http://localhost:3001"],
  );
});
