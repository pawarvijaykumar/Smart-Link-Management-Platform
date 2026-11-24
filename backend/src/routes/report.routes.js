import { Router } from "express";
import {
  downloadCsvReport,
  downloadPdfReport,
  getReportCategories,
} from "../controllers/report.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router.get("/csv", downloadCsvReport);
router.get("/pdf", downloadPdfReport);
router.get("/categories", getReportCategories);

export default router;
