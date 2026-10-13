
import { Router } from "express";
import { createLink,redirectLink ,getClickHistory,getMyLinks} from "../controllers/link.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();


router.post("/", verifyJWT, createLink);

// Get all links belonging to the logged-in user
router.get("/my-links", verifyJWT, getMyLinks);

// Get click history for a specific short link
router.get("/:shortCode/history", verifyJWT, getClickHistory);

// Redirect visitors to the original URL
router.get("/:shortCode", redirectLink);




export default router;
