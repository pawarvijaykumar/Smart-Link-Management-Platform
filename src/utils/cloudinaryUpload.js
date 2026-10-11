
import imagekit from "../config/imagekit.js";
import fs from "fs";

const uploadOnImageKit = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    const response = await imagekit.upload({
      file: fs.readFileSync(localFilePath),
      fileName: localFilePath.split(/[\\/]/).pop(),
      folder: "/smart-link-management",
    });

    return response;
  } catch (error) {
    console.error("ImageKit upload failed:", error.message);
    return null;
  }
};

export { uploadOnImageKit };
