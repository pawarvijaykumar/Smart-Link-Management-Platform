
import { Router } from "express";
import {
  createLink,
  redirectLink,
  getClickHistory,
  getLinkAnalytics,
  getAllLinksAnalytics,
  getMyLinks,
} from "../controllers/link.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", verifyJWT, createLink);

// Get all links belonging to the logged-in user
router.get("/my-links", verifyJWT, getMyLinks);

// Get aggregated analytics across all links belonging to the logged-in user
router.get("/user/analytics/all-links", verifyJWT, getAllLinksAnalytics);
router.get("/all/analytics", verifyJWT, getAllLinksAnalytics);

// Get click analytics for a specific short link
router.get("/:shortCode/analytics", verifyJWT, getLinkAnalytics);

// Get click history for a specific short link
router.get("/:shortCode/history", verifyJWT, getClickHistory);

// Redirect visitors to the original URL
router.get("/:shortCode", redirectLink);




export default router;
