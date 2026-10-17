
import { Router } from "express";
import { uploadImage } from "../controllers/upload.controller.js";
import { upload } from "../middleware/multer.middleware.js";

import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// Upload a single image (requires authentication)
router.post("/image", verifyJWT, upload.single("image"), uploadImage);

export default router;
