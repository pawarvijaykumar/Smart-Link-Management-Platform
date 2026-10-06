/*
Think of index.js as the main entry point / manager of your backend application
index.js
   │
   ├── Express
   ├── Middleware
   ├── Database connection
   ├── Routes
   └── Server

                       CLIENT
                  (Postman)
                      │
                      ↓
                 index.js
              ┌───────┴───────┐
              │               │
          Middleware       Routes
                              │
                              ↓
                       user.routes.js
                              │
                              ↓
                    user.controller.js
                              │
                              ↓
                       User Model
                              │
                              ↓
                           MongoDB
index.js
Main manager
"Start the application and connect everything."

routes/user.routes.js
Traffic controller
"Which function should handle this request?"

controllers/user.controller.js
Logic
"What should happen?"

models/user.model.js
Database structure + database operations
"How is a User stored/interacted with?"

MongoDB
Actual database
"Where is the data stored?"
*/

import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import userRouter from "./routes/user.routes.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use("/api", userRouter);

// MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");

    app.listen(5000, () => {
      console.log("Server running on port 5000");
    });
  })
  .catch((error) => {
    console.log("MongoDB connection failed:", error);
  });