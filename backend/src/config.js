import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(?:\+srv)?:\/\//)
    .default("mongodb://127.0.0.1:27017/news_pulse"),
  MONGODB_DB: z
    .string()
    .regex(/^[\w-]+$/)
    .default("news_pulse"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
  PYTHON_BIN: z.string().min(1).default("python"),
  INGEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(600000),
  INGEST_COOLDOWN_MS: z.coerce.number().int().min(0).default(60000),
  TRUST_PROXY: z.coerce.number().int().min(0).max(2).default(0),
  SIMILARITY_THRESHOLD: z.coerce.number().gt(0).max(1).default(0.18),
  MAX_ARTICLES_PER_FEED: z.coerce.number().int().min(1).max(100).default(25),
  CLUSTER_WINDOW_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  HTTP_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(30).default(15),
});
export function readConfig(env = process.env) {
  if (
    env.NODE_ENV === "production" &&
    (!env.MONGODB_URI || !env.FRONTEND_ORIGIN)
  ) {
    throw new Error("Production requires MONGODB_URI and FRONTEND_ORIGIN.");
  }
  const parsed = schema.safeParse(env);
  if (!parsed.success)
    throw new Error(
      `Invalid environment variables: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  const config = parsed.data;
  config.origins = config.FRONTEND_ORIGIN.split(",").map((s) => {
    const url = new URL(s.trim());
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error("FRONTEND_ORIGIN must contain exact HTTP origins.");
    return url.origin;
  });
  return config;
}
