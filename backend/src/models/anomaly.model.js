import mongoose from "mongoose";

const anomalySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    link: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Link",
      required: true,
      index: true,
    },
    shortCode: {
      type: String,
      required: true,
      trim: true,
    },
    originalUrl: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["SPIKE", "DROP"],
      required: true,
    },
    severity: {
      type: String,
      enum: ["CRITICAL", "WARNING", "INFO"],
      default: "WARNING",
    },
    status: {
      type: String,
      enum: ["new", "acknowledged", "resolved"],
      default: "new",
      index: true,
    },
    currentClicks: {
      type: Number,
      required: true,
    },
    baselineAverage: {
      type: Number,
      required: true,
    },
    percentageDeviation: {
      type: Number,
      default: null,
    },
    absoluteDifference: {
      type: Number,
      default: 0,
    },
    deviationDisplay: {
      type: String,
      default: "",
    },
    baselineCalculation: {
      type: String,
      default: "",
    },
    historicalPeriod: {
      type: String,
      default: "",
    },
    zScore: {
      type: Number,
      default: 0,
    },
    date: {
      type: String,
      required: true,
    },
    detectionTimestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    rootCause: {
      type: String,
      default: "",
    },
    recommendation: {
      type: String,
      default: "",
    },
    dedupKey: {
      type: String,
      unique: true,
      index: true,
    },
  },
  { timestamps: true }
);

anomalySchema.index({ user: 1, date: -1 });
anomalySchema.index({ user: 1, status: 1 });
anomalySchema.index({ link: 1, date: -1 });

const Anomaly = mongoose.model("Anomaly", anomalySchema);

export default Anomaly;