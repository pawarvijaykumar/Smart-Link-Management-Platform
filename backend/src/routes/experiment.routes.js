import express from "express";
import {
  createExperiment,
  getExperiments,
  getExperimentById,
  updateExperiment,
  updateExperimentStatus,
  getExperimentAnalytics,
} from "../controllers/experiment.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

// =============================================================================
// CHANGE: Stage 13 A/B Testing Routes — 2026-11-17
// Authenticated endpoints for A/B experiment creation, management, lifecycle,
// and statistical analytics.
// =============================================================================
const router = express.Router();

router.use(verifyJWT);

router.post("/", createExperiment);
router.get("/", getExperiments);
router.get("/:id", getExperimentById);
router.patch("/:id", updateExperiment);
router.patch("/:id/status", updateExperimentStatus);
router.get("/:id/analytics", getExperimentAnalytics);

export default router;
