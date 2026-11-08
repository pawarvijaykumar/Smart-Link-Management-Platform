import mongoose from "mongoose";

const linkSchema = new mongoose.Schema(
  {
    originalUrl: {//The original website, such as https://google.com
      type: String,
      required: true,
      trim: true,
    },

    shortCode: {//The unique identifier, such as abc123
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    user: {//The ID of the user who created the link
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    clicks: {//Starts at 0 and increases when visitors use the link
      type: Number,
      default: 0,
    },

    // CHANGE: Added optional UTM campaign fields — 2026-11-01


    /*
   utmSource (e.g., "google", "newsletter", "twitter"):
Identifies the platform, site, or referrer where the link is being published. Answers: "Where is the traffic coming from?"

  
utmMedium (e.g., "cpc", "email", "social", "banner"):
Identifies the marketing medium or channel type. Answers: "How is the link reaching visitors?"

  
utmCampaign (e.g., "diwali_sale", "product_launch_v2"):
Identifies the specific marketing campaign or promotion name. Answers: "Which campaign generated this click?"

  
utmTerm (e.g., "link-management", "analytics-tool"):
Identifies paid search keywords or audience segment tags associated with the link.

  
utmContent (e.g., "header_button", "sidebar_banner", "text_link"):
Identifies the specific creative or element clicked, useful for A/B testing different links within the same campaign.
    
    */
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
    // CHANGE: Notifications Step 3B — 2026-11-04
    // Tracks achieved click milestones to prevent duplicate notifications under concurrency
    notifiedMilestones: {
      type: [Number],
      default: [],
    },

    // CHANGE: Stage 7 — Smart Link Expiration & Access Control — 2026-11-07
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
  },
  {
    timestamps: true,//Automatically records createdAt and updatedAt
  }
);

// Compound index to optimize user dashboard queries and eliminate in-memory sorting
linkSchema.index({ user: 1, createdAt: -1 });

const Link = mongoose.model("Link", linkSchema);

export default Link;
