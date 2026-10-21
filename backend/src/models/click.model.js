
import mongoose from "mongoose";

const clickSchema = new mongoose.Schema(
  {
    link: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Link",
      required: true,
    },
    clickedAt: {
      type: Date,
      default: Date.now,
    },
    deviceType: {
      type: String,
      enum: ["mobile", "desktop", "tablet", "unknown"],
      default: "unknown",
    },
    browser: {
      type: String,
      default: "Unknown",
    },
  },
  { timestamps: true }
);

// Compound index to optimize click history retrieval and eliminate in-memory sorting
clickSchema.index({ link: 1, clickedAt: -1 });

const Click = mongoose.model("Click", clickSchema);

export default Click;
