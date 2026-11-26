import { Router } from "express";
import {
  getActivityAnalytics,
  getRecentClicks,
  getTopLinks,
} from "../controllers/analytics.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// Owner-scoped activity & live engagement analytics
router.get("/activity", verifyJWT, getActivityAnalytics);
router.get("/recent-clicks", verifyJWT, getRecentClicks);
router.get("/top-links", verifyJWT, getTopLinks);

export default router;
