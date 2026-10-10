//Controls the complete upload process by connecting these parts.


import fs from "fs";
import { uploadOnCloudinary } from "../utils/cloudinaryUpload.js";

const uploadImage = async (req, res) => {
  try {
    // Check whether an image was received
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image",
      });
    }

    // Get the temporary image path
    const localFilePath = req.file.path;

    // Upload the image to Cloudinary
    const uploadedImage = await uploadOnCloudinary(localFilePath);

    // Check whether Cloudinary upload succeeded
    if (!uploadedImage) {
      return res.status(500).json({
        success: false,
        message: "Image upload failed",
      });
    }

    // Delete the temporary image from our computer
    fs.unlink(localFilePath, (error) => {
      if (error) {
        console.error("Temporary file cleanup failed:", error.message);
      }
    });

    // Send the uploaded image URL to the client
    return res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      imageUrl: uploadedImage.secure_url,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong while uploading the image",
    });
  }
};

export { uploadImage };
