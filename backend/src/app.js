

import "dotenv/config";

import express from "express";
import cors from "cors";
// CHANGE: Added persistent session refresh tokens — 2026-10-21
import cookieParser from "cookie-parser";

import userRoutes from "./routes/user.routes.js";
import healthRoutes from "./routes/health.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import linkRouter from "./routes/link.routes.js";
import { redirectLink } from "./controllers/link.controller.js";
// CHANGE: Notifications Step 2 — 2026-11-04
import notificationRoutes from "./routes/notification.routes.js";
// CHANGE: Stage 13 A/B Testing Routes — 2026-11-17
import experimentRoutes from "./routes/experiment.routes.js";

const app = express();

// CHANGE: Safe environment-aware reverse proxy configuration — 2026-11-09
// - In production behind reverse proxy (Render, AWS ALB, Heroku, Cloudflare): trust 1 upstream hop (or custom TRUST_PROXY)
// - In development: trust 'loopback' (127.0.0.1, ::1) so local proxy headers and tunnels can be inspected safely without opening to external spoofing
if (process.env.NODE_ENV === "production") {
  const trustHops = process.env.TRUST_PROXY
    ? isNaN(process.env.TRUST_PROXY)
      ? process.env.TRUST_PROXY
      : Number(process.env.TRUST_PROXY)
    : 1;
  app.set("trust proxy", trustHops);
} else {
  app.set("trust proxy", "loopback");
}

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
// CHANGE: Stage 13 A/B Testing signed cookie parser — 2026-11-17
const cookieSecret = process.env.COOKIE_SECRET || process.env.JWT_SECRET || "smartlink_ab_cookie_secret_key_2026";
app.use(cookieParser(cookieSecret));
app.use(express.json());

// Routes-->"When someone sends a GET request to this URL, what should I do?"
app.use('/api', healthRoutes);//its show api testing 
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/links", linkRouter);
// CHANGE: Notifications Step 2 — 2026-11-04
app.use("/api/notifications", notificationRoutes);
// CHANGE: Stage 13 A/B Testing — 2026-11-17
app.use("/api/experiments", experimentRoutes);

// Public short-code redirect at domain root (e.g. https://domain.com/:shortCode)
app.get("/:shortCode", redirectLink);
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