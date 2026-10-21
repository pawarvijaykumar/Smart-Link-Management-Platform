import { Router } from "express";

// CHANGE: Added persistent session refresh tokens — 2026-10-21
import {
  createUser,
  getUsers,
  updateUser,
  deleteUser,
  loginUser,
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
router.post("/refresh-token", refreshToken);
router.post("/logout", logoutUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/", verifyJWT, getUsers);
router.patch("/:id", verifyJWT, updateUser);//PATCH
router.delete("/:id",verifyJWT, deleteUser);//DELETE
router.get("/me", verifyJWT, getMyProfile);
/* why usee the "/"-->
/api/v1/users
       +
router.get("/")
       =
GET /api/v1/users*/

// If a POST request comes to /register, execute createUser.

/*
POST /users
    ↓
Router checks the URL + method
    ↓
"Okay, this is /users with POST"
    ↓
Call createUser()*/

export default router;