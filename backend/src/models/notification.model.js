import mongoose from "mongoose";

// CHANGE: Notifications Step 1 — 2026-11-03
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
    enum: ["link", "milestone", "campaign", "system"],
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  // CHANGE: Notifications Step 3B — 2026-11-04
  // Unique idempotency key for database-enforced duplicate prevention
  idempotencyKey: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Useful indexes for retrieving user notifications in newest-first order and filtering unread notifications
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

// CHANGE: Notifications Step 3B — 2026-11-04
// Database-enforced uniqueness guarantee: prevents duplicate notifications under concurrent requests
notificationSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true }
);

const Notification = mongoose.model("Notification", notificationSchema);

export { Notification };
export default Notification;
