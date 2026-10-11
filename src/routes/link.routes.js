
import { Router } from "express";
import { createLink } from "../controllers/link.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", verifyJWT, createLink);

export default router;
