
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
  },
  {
    timestamps: true,//Automatically records createdAt and updatedAt
  }
);

// Compound index to optimize user dashboard queries and eliminate in-memory sorting
linkSchema.index({ user: 1, createdAt: -1 });

const Link = mongoose.model("Link", linkSchema);

export default Link;
