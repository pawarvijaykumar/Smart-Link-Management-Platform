import { Router } from "express";
import {
  createExperiment,
  getExperiments,
  getExperimentById,
  updateExperiment,
  updateExperimentStatus,
  getExperimentAnalytics,
} from "../controllers/experiment.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router.post("/", createExperiment);
router.get("/", getExperiments);
router.get("/:id", getExperimentById);
router.patch("/:id", updateExperiment);
router.patch("/:id/status", updateExperimentStatus);
router.get("/:id/analytics", getExperimentAnalytics);

export default router;
