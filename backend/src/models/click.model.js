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
    isQR: {
      type: Boolean,
      default: false,
      index: true,
    },
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
    browserVersion: {
      type: String,
      default: "Unknown",
      trim: true,
    },
    operatingSystem: {
      type: String,
      default: "Unknown",
      trim: true,
      index: true,
    },
    osVersion: {
      type: String,
      default: "Unknown",
      trim: true,
    },
    deviceVendor: {
      type: String,
      default: "Unknown",
      trim: true,
      index: true,
    },
    deviceModel: {
      type: String,
      default: "Unknown",
      trim: true,
    },
    experimentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Experiment",
      default: null,
      index: true,
    },
    experimentVariant: {
      type: String,
      enum: ["A", "B", null],
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

clickSchema.index({ link: 1, clickedAt: -1 });
clickSchema.index({ link: 1, countryCode: 1, clickedAt: -1 });
clickSchema.index({ link: 1, operatingSystem: 1, clickedAt: -1 });
clickSchema.index({ link: 1, deviceVendor: 1, clickedAt: -1 });
clickSchema.index({ experimentId: 1, experimentVariant: 1, clickedAt: -1 });
clickSchema.index({ experimentId: 1, clickedAt: -1 });

const Click = mongoose.model("Click", clickSchema);

export default Click;