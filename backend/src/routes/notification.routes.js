import { Router } from "express";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../controllers/notification.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

// CHANGE: Notifications Step 2 — 2026-11-04
const router = Router();

// Apply verifyJWT authentication to all notification routes
router.use(verifyJWT);

// Fetch notifications belonging to the logged-in user
router.get("/", getNotifications);

// Mark all unread notifications of the logged-in user as read
router.patch("/read-all", markAllNotificationsAsRead);

// Mark a single notification as read
router.patch("/:notificationId/read", markNotificationAsRead);

// Delete a single notification
router.delete("/:notificationId", deleteNotification);

export default router;
