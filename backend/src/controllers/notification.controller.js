import mongoose from "mongoose";
import Notification from "../models/notification.model.js";

// CHANGE: Notifications Step 2 — 2026-11-04

/**
 * Fetch notifications belonging only to the logged-in user, newest first.
 * Supports optional pagination (page, limit) and unread-only filtering.
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Strict user scoping
    const query = { user: userId };

    if (req.query.unread === "true") {
      query.isRead = false;
    }

    const hasPagination = Boolean(req.query.page || req.query.limit);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = req.query.limit
      ? Math.max(1, Math.min(parseInt(req.query.limit), 100))
      : 50;
    const skip = (page - 1) * limit;

    let notificationsQuery = Notification.find(query).sort({ createdAt: -1 });

    if (hasPagination) {
      notificationsQuery = notificationsQuery.skip(skip).limit(limit);
    }

    const [notifications, totalNotifications, unreadCount] = await Promise.all([
      notificationsQuery.lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: userId, isRead: false }),
    ]);

    const responsePayload = {
      success: true,
      unreadCount,
      totalNotifications,
      data: notifications,
    };

    if (hasPagination) {
      responsePayload.page = page;
      responsePayload.limit = limit;
      responsePayload.totalPages = Math.ceil(totalNotifications / limit) || 1;
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Get notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

/**
 * Mark a single notification as read.
 * Scoped strictly to the logged-in user.
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID format",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { $set: { isRead: true } },
      { new: true }
    ).lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
};

/**
 * Mark all unread notifications of the logged-in user as read.
 * Scoped strictly to the logged-in user.
 */
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
    });
  }
};

/**
 * Delete a single notification belonging to the logged-in user.
 * Scoped strictly to the logged-in user.
 */
const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID format",
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: userId,
    }).lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
};

export {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
};
