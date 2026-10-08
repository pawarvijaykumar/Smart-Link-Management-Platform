import { Router } from "express";

import { createUser, getUsers,updateUser,deleteUser ,loginUser} from "../controllers/user.controller.js";

const router = Router();

router.post("/register", createUser);
router.post("/login", loginUser);//use this api POST http://localhost:5000/api/v1/users/login
router.get("/", getUsers);//GET
router.patch("/:id", updateUser);//PATCH
router.delete("/:id", deleteUser);//DELETE
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