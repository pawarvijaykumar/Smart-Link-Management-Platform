
import { Router } from "express";
import {
  createLink,
  redirectLink,
  getClickHistory,
  getLinkAnalytics,
  getAllLinksAnalytics,
  getMyLinks,
  getCampaignAnalytics,
  getQRAnalytics,
  updateLinkAccess,
  togglePauseLink,
  getGeoAnalytics,
  getDeviceAnalytics,
  getTrafficAnalytics,
  getLinkComparisonAnalytics,
  getTrafficAnomalies,
  updateAnomalyStatus,
  acknowledgeAnomaly,
  resolveAnomaly,
} from "../controllers/link.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", verifyJWT, createLink);

// Get all links belonging to the logged-in user
router.get("/my-links", verifyJWT, getMyLinks);

// Get aggregated analytics across all links belonging to the logged-in user
router.get("/user/analytics/all-links", verifyJWT, getAllLinksAnalytics);
router.get("/all/analytics", verifyJWT, getAllLinksAnalytics);

router.get("/user/analytics/campaigns", verifyJWT, getCampaignAnalytics);
router.get("/user/analytics/qr", verifyJWT, getQRAnalytics);
router.get("/user/analytics/geo", verifyJWT, getGeoAnalytics);
router.get("/user/analytics/devices", verifyJWT, getDeviceAnalytics);
router.get("/user/analytics/traffic", verifyJWT, getTrafficAnalytics);
router.get("/user/analytics/comparison", verifyJWT, getLinkComparisonAnalytics);
router.post("/user/analytics/comparison", verifyJWT, getLinkComparisonAnalytics);
router.get("/user/analytics/anomalies", verifyJWT, getTrafficAnomalies);
router.patch("/user/analytics/anomalies/:id/status", verifyJWT, updateAnomalyStatus);
router.patch("/user/analytics/anomalies/:id/acknowledge", verifyJWT, acknowledgeAnomaly);
router.patch("/user/analytics/anomalies/:id/resolve", verifyJWT, resolveAnomaly);

router.patch("/:id/access", verifyJWT, updateLinkAccess);
router.patch("/:id/pause", verifyJWT, togglePauseLink);
router.patch("/:id/toggle-pause", verifyJWT, togglePauseLink);
router.patch("/:id", verifyJWT, updateLinkAccess);

// Get click analytics for a specific short link
router.get("/:shortCode/analytics", verifyJWT, getLinkAnalytics);

// Get click history for a specific short link
router.get("/:shortCode/history", verifyJWT, getClickHistory);

// Redirect visitors to the original URL
router.get("/:shortCode", redirectLink);

export default router;
