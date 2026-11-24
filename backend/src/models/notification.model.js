import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: ["link", "milestone", "campaign", "system", "anomaly", "experiment"],
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  idempotencyKey: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true }
);

const Notification = mongoose.model("Notification", notificationSchema);

export { Notification };
export default Notification;