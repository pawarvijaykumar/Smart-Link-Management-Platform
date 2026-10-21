import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
// CHANGE: Added password recovery — 2026-10-20
import crypto from "crypto";
import { sendPasswordResetEmail } from "../utils/emailService.js";

//POST use to api test
const createUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || typeof username !== "string" || !username.trim()) {
      return res.status(400).json({
        success: false,
        message: "Username is required",
      });
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};


//PATCH -> it only chage the value it vijay t king
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.userId !== id) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own account",
      });
    }

    const { username, email } = req.body;
    const updateData = {};

    if (username && typeof username === "string" && username.trim()) {
      updateData.username = username.trim();
    }

    if (email && typeof email === "string" && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address",
        });
      }
      updateData.email = email.trim().toLowerCase();
    }

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.userId !== id) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own account",
      });
    }

    const user = await User.findByIdAndDelete(id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
      user,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};

// CHANGE: Added persistent session refresh tokens — 2026-10-21
const isProduction = process.env.NODE_ENV === "production";

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days persistent session
  path: "/api/v1/users",
});

const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "15m" });
};

const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString("hex");
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from environment variables");
      return res.status(500).json({
        success: false,
        message: "Authentication service misconfiguration",
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    // Generate short-lived access token (15m) and long-lived persistent refresh token (7d)
    const accessToken = generateAccessToken(user._id);
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Prune expired tokens and append new session token (keep max 5 active sessions)
    const validTokens = (user.refreshTokens || []).filter((t) => t.expiresAt > now);
    validTokens.push({ tokenHash, expiresAt, createdAt: now });
    user.refreshTokens = validTokens.slice(-5);
    await user.save();

    // Set secure HTTP-only refresh cookie
    res.cookie("refreshToken", rawRefreshToken, getRefreshCookieOptions());

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshTokens;
    delete userResponse.resetPasswordToken;
    delete userResponse.resetPasswordExpires;

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: accessToken,
      user: userResponse,
    });
  } catch (error) {
    console.error("Login user error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to log in",
    });
  }
};

// CHANGE: Added persistent session refresh tokens — 2026-10-21
const refreshToken = async (req, res) => {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) {
      return res.status(401).json({
        success: false,
        message: "No refresh token provided",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Authentication service misconfiguration",
      });
    }

    const hashed = hashToken(rawToken);
    const now = new Date();

    // Find user having this active refresh token
    const user = await User.findOne({
      "refreshTokens.tokenHash": hashed,
    });

    if (!user) {
      res.clearCookie("refreshToken", getRefreshCookieOptions());
      return res.status(401).json({
        success: false,
        message: "Session expired or invalid. Please sign in again.",
      });
    }

    // Check if the specific token is expired
    const tokenDoc = (user.refreshTokens || []).find((t) => t.tokenHash === hashed);
    if (!tokenDoc || tokenDoc.expiresAt <= now) {
      user.refreshTokens = (user.refreshTokens || []).filter((t) => t.expiresAt > now);
      await user.save();
      res.clearCookie("refreshToken", getRefreshCookieOptions());
      return res.status(401).json({
        success: false,
        message: "Session expired. Please sign in again.",
      });
    }

    // Token rotation: replace used refresh token with a new one
    const newRawRefreshToken = generateRefreshToken();
    const newHashed = hashToken(newRawRefreshToken);

    const activeTokens = (user.refreshTokens || []).filter(
      (t) => t.tokenHash !== hashed && t.expiresAt > now
    );
    activeTokens.push({
      tokenHash: newHashed,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
    });
    user.refreshTokens = activeTokens.slice(-5);
    await user.save();

    // Issue fresh access token (15m)
    const newAccessToken = generateAccessToken(user._id);

    // Set fresh rotated cookie
    res.cookie("refreshToken", newRawRefreshToken, getRefreshCookieOptions());

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshTokens;
    delete userResponse.resetPasswordToken;
    delete userResponse.resetPasswordExpires;

    return res.status(200).json({
      success: true,
      message: "Session refreshed successfully",
      token: newAccessToken,
      user: userResponse,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to refresh session",
    });
  }
};

// CHANGE: Added persistent session refresh tokens — 2026-10-21
const logoutUser = async (req, res) => {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (rawToken) {
      const hashed = hashToken(rawToken);
      await User.updateOne(
        { "refreshTokens.tokenHash": hashed },
        { $pull: { refreshTokens: { tokenHash: hashed } } }
      );
    }

    res.clearCookie("refreshToken", getRefreshCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout user error:", error);
    res.clearCookie("refreshToken", getRefreshCookieOptions());
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  }
};
const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("-password")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      user
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CHANGE: Added password recovery — 2026-10-20
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email address is required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (user) {
      // 1. Generate cryptographically secure 32-byte hex token
      const resetToken = crypto.randomBytes(32).toString("hex");

      // 2. Hash token with SHA-256 for storage in database
      const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      // 3. Set token and 1-hour expiration time
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      // 4. Send email via emailService (asynchronous, non-blocking)
      sendPasswordResetEmail(user.email, user.username, resetToken).catch((err) => {
        console.error("Non-blocking password reset email error:", err.message);
      });
    }

    // 5. Always return a generic response to prevent account/email enumeration
    return res.status(200).json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to process password reset request at this time.",
    });
  }
};

// CHANGE: Added password recovery — 2026-10-20
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    // Hash the incoming token with SHA-256 to compare with database hash
    const hashedToken = crypto
      .createHash("sha256")
      .update(token.trim())
      .digest("hex");

    // Find user with valid, unexpired token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Password reset link is invalid or has expired.",
      });
    }

    // Hash the new password using existing bcrypt settings
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    // Invalidate the reset token immediately (single-use)
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to reset password. Please try again.",
    });
  }
};

export {
  createUser,
  getUsers,
  updateUser,
  deleteUser,
  loginUser,
  getMyProfile,
  forgotPassword,
  resetPassword,
  // CHANGE: Added persistent session refresh tokens — 2026-10-21
  refreshToken,
  logoutUser,
};


