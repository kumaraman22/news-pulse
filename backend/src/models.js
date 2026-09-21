import mongoose from "mongoose";
const { Schema } = mongoose;
const articleSchema = new Schema(
  {
    title: String,
    summary: String,
    content: String,
    source: String,
    url: { type: String, required: true, unique: true },
    imageUrl: String,
    author: String,
    publishedAt: { type: Date, index: true },
    ingestedAt: Date,
    clusterId: String,
    contentHash: { type: String, unique: true, required: true },
    extractionMethod: String,
    dateEstimated: Boolean,
  },
  { collection: "articles" },
);
articleSchema.index({ source: 1, publishedAt: -1 });
export const clusterSchema = new Schema(
  {
    _id: String,
    label: String,
    keywords: [String],
    articleIds: [Schema.Types.ObjectId],
    articleCount: Number,
    sources: [String],
    startTime: Date,
    endTime: Date,
    createdAt: Date,
    updatedAt: Date,
  },
  { _id: false },
);
// One bounded snapshot is published atomically; readers never see half-rebuilt clusters.
const snapshotSchema = new Schema(
  {
    _id: String,
    clusters: [clusterSchema],
    updatedAt: Date,
    sources: [String],
    articleCount: Number,
    truncated: Boolean,
  },
  { collection: "snapshots" },
);
const jobSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      required: true,
    },
    active: Boolean,
    startedAt: Date,
    completedAt: Date,
    articlesAdded: { type: Number, default: 0 },
    clustersCreated: { type: Number, default: 0 },
    errorMessage: String,
    warnings: [String],
    progress: String,
    feedResults: [Schema.Types.Mixed],
  },
  { collection: "ingestionjobs", timestamps: true },
);
jobSchema.index(
  { active: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
export const Article = mongoose.model("Article", articleSchema);
export const Snapshot = mongoose.model("Snapshot", snapshotSchema);
export const IngestionJob = mongoose.model("IngestionJob", jobSchema);
