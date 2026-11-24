import { Router } from "express";

import {
  createUser,
  getUsers,
  updateUser,
  deleteUser,
  loginUser,
  googleLoginUser,
  getMyProfile,
  forgotPassword,
  resetPassword,
  refreshToken,
  logoutUser,
} from "../controllers/user.controller.js";

import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", createUser);
router.post("/login", loginUser);
router.post("/google", googleLoginUser);
router.post("/refresh-token", refreshToken);
router.post("/logout", logoutUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/", verifyJWT, getUsers);
router.patch("/:id", verifyJWT, updateUser);
router.delete("/:id", verifyJWT, deleteUser);
router.get("/me", verifyJWT, getMyProfile);

export default router;