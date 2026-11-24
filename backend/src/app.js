

import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import userRoutes from "./routes/user.routes.js";
import healthRoutes from "./routes/health.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import linkRouter from "./routes/link.routes.js";
import { redirectLink } from "./controllers/link.controller.js";
import notificationRoutes from "./routes/notification.routes.js";
import experimentRoutes from "./routes/experiment.routes.js";
import reportRoutes from "./routes/report.routes.js";

const app = express();

// Trust proxy: production behind reverse proxy, dev only trusts loopback
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

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

const cookieSecret = process.env.COOKIE_SECRET || process.env.JWT_SECRET || "smartlink_ab_cookie_secret_key_2026";
app.use(cookieParser(cookieSecret));
app.use(express.json());

app.use("/api", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/links", linkRouter);
app.use("/api/notifications", notificationRoutes);
app.use("/api/experiments", experimentRoutes);
app.use("/api/reports", reportRoutes);

// Public short-code redirect at domain root (e.g. https://domain.com/:shortCode)
app.get("/:shortCode", redirectLink);

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

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Resource not found" });
});

export default app;