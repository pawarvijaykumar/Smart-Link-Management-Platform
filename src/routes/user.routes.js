import { Router } from "express";

import { createUser } from "../controllers/user.controller.js";

const router = Router();

router.post("/register", createUser);// If a POST request comes to /register, execute createUser.
/*
POST /users
    ↓
Router checks the URL + method
    ↓
"Okay, this is /users with POST"
    ↓
Call createUser()*/

export default router;