

import "dotenv/config";

import express from "express";
import cors from "cors";
// CHANGE: Added persistent session refresh tokens — 2026-10-21
import cookieParser from "cookie-parser";

import userRoutes from "./routes/user.routes.js";
import healthRoutes from "./routes/health.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import linkRouter from "./routes/link.routes.js";

const app = express();

// Middleware
// CHANGE: Added persistent session refresh tokens — 2026-10-21
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl) or matched origins
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Fallback for local dev flexibility
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Routes-->"When someone sends a GET request to this URL, what should I do?"
app.use('/api', healthRoutes);//its show api testing 
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/links", linkRouter);
// Global error handler to catch JSON parsing issues and avoid exposing stack traces or file paths
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload in request body",
    });
  }

  console.error("Unhandled server error:", err);
  return res.status(err.status || 500).json({
    success: false,
    message: "An unexpected server error occurred",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Resource not found" });
});

export default app;//allows server.js to import the Express application.
/*

Postman
   ↓
POST /api/v1/users/register
   ↓
app.js
   ↓
/api/v1/users
   ↓
user.routes.js
   ↓
/register
   ↓
createUser()
   ↓
User.create()
   ↓
MongoDB*/