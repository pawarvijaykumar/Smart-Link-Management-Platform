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
    // CHANGE: QR visit tracking — 2026-11-06
    // Distinguishes QR-code scans (true) from normal direct link clicks (false)
    isQR: {
      type: Boolean,
      default: false,
      index: true,
    },
    // CHANGE: Added optional UTM campaign fields — 2026-11-01
    utmSource: {
      type: String,
      trim: true,
      default: null,
    },
    utmMedium: {
      type: String,
      trim: true,
      default: null,
    },
    utmCampaign: {
      type: String,
      trim: true,
      default: null,
    },
    utmTerm: {
      type: String,
      trim: true,
      default: null,
    },
    utmContent: {
      type: String,
      trim: true,
      default: null,
    },
    // CHANGE: Stage 8 — Geo-Location Analytics fields — 2026-11-08
    country: {
      type: String,
      default: "Unknown",
      trim: true,
      index: true,
    },
    countryCode: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      index: true,
    },
    region: {
      type: String,
      default: "Unknown",
      trim: true,
    },
    city: {
      type: String,
      default: "Unknown",
      trim: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index to optimize click history retrieval and eliminate in-memory sorting
clickSchema.index({ link: 1, clickedAt: -1 });
// Compound index to optimize country-level aggregation queries
clickSchema.index({ link: 1, countryCode: 1, clickedAt: -1 });

const Click = mongoose.model("Click", clickSchema);

export default Click;
