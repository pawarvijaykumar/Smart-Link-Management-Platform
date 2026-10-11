
import Link from "../models/link.model.js";
import crypto from "crypto";

const createLink = async (req, res) => {
  try {
    const { originalUrl } = req.body;

    // Check whether the URL was provided
    if (!originalUrl) {
      return res.status(400).json({
        success: false,
        message: "Original URL is required",
      });
    }

    // Generate a unique short code
    const shortCode = crypto.randomBytes(4).toString("hex");//Generates random bytes for a short code

    // Save the link in MongoDB
    const link = await Link.create({
      originalUrl,
      shortCode,
      user: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Short link created successfully",
      data: link,
    });
  } catch (error) {
    console.error("Create link error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create short link",
    });
  }
};

export { createLink };
