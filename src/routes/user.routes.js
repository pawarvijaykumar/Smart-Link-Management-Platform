import { Router } from "express";
import { createUser } from "../controllers/user.controller.js";

const router = Router();

router.post("/users", createUser);//If a POST request comes to /users, execute createUser.
/*
POST /users
    ↓
Router checks the URL + method
    ↓
"Okay, this is /users with POST"
    ↓
Call createUser()*/

export default router;