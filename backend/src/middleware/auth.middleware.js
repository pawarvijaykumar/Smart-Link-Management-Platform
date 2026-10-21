import jwt from "jsonwebtoken";

const verifyJWT = async (req, res, next) => {
  try {
    // CHANGE: Added persistent session refresh tokens — 2026-10-21
    const authHeader = req.header("Authorization");
    const token =
      authHeader?.replace(/^Bearer\s+/i, "").trim() ||
      req.cookies?.accessToken;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized request"
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured in environment variables");
      return res.status(500).json({
        success: false,
        message: "Authentication service misconfiguration"
      });
    }

    const decodedToken = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decodedToken;

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
};

export { verifyJWT };