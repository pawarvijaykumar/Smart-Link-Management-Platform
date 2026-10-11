//Controls the complete upload process by connecting these parts.



import fs from "fs/promises";
import { uploadOnImageKit } from "../utils/cloudinaryUpload.js";

const uploadImage = async (req, res) => {
  const localFilePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image",
      });
    }

    const uploadedImage = await uploadOnImageKit(localFilePath);

    if (!uploadedImage) {
      return res.status(500).json({
        success: false,
        message: "Image upload failed",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      imageUrl: uploadedImage.url,
    });
  } catch (error) {
    console.error("Image upload controller error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while uploading the image",
    });
  } finally {
    if (localFilePath) {
      try {
        await fs.unlink(localFilePath);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error("Temporary file cleanup failed:", error.message);
        }
      }
    }
  }
};

export { uploadImage };
