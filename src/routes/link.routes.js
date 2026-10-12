
import { Router } from "express";
import { createLink,redirectLink ,getClickHistory} from "../controllers/link.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", verifyJWT, createLink);
// Redirect visitors (no login required)
router.get("/:shortCode", redirectLink);
router.get("/:shortCode/history", verifyJWT,getClickHistory
);

export default router;
