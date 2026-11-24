import mongoose from "mongoose";

const linkSchema = new mongoose.Schema(
  {
    originalUrl: {
      type: String,
      required: true,
      trim: true,
    },

    shortCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    clicks: {
      type: Number,
      default: 0,
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

    notifiedMilestones: {
      type: [Number],
      default: [],
    },

    expiresAt: {
      type: Date,
      default: null,
    },
    maxClicks: {
      type: Number,
      default: null,
      min: 1,
    },
    isPaused: {
      type: Boolean,
      default: false,
    },

    isExperiment: {
      type: Boolean,
      default: false,
      index: true,
    },
    experiment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Experiment",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

linkSchema.index({ user: 1, createdAt: -1 });

const Link = mongoose.model("Link", linkSchema);

export default Link;