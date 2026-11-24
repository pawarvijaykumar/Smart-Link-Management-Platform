import mongoose from "mongoose";

const experimentSchema = new mongoose.Schema(
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
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    variantA: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
    },
    variantB: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
    },
    trafficSplit: {
      a: {
        type: Number,
        default: 50,
      },
      b: {
        type: Number,
        default: 50,
      },
    },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed"],
      default: "draft",
      index: true,
    },
    fallbackVariant: {
      type: String,
      enum: ["A", "B"],
      default: "A",
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

experimentSchema.index({ user: 1, createdAt: -1 });
experimentSchema.index({ user: 1, status: 1 });

const Experiment = mongoose.model("Experiment", experimentSchema);

export default Experiment;