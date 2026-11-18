// =============================================================================
// Stage 14: Report Routes — 2026-11-19
// Authenticated endpoints for downloading PDF and CSV analytics reports.
// =============================================================================

import express from "express";
import {
  downloadCsvReport,
  downloadPdfReport,
  getReportCategories,
} from "../controllers/report.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = express.Router();

// Require JWT authentication for all report operations
router.use(verifyJWT);

// Export CSV dataset
router.get("/csv", downloadCsvReport);

// Export PDF report
router.get("/pdf", downloadPdfReport);

// Report categories metadata
router.get("/categories", getReportCategories);

export default router;
