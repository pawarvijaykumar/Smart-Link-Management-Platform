
import { Router } from "express";
import { uploadImage } from "../controllers/upload.controller.js";
import { upload } from "../middleware/multer.middleware.js";

const router = Router();

// Upload a single image
router.post("/image", upload.single("image"), uploadImage);

export default router;
