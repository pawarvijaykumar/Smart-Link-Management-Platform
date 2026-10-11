import "dotenv/config";
import { cloudinary } from "./src/config/cloudinary.js";

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

for (const type of ["image", "auto"]) {
  try {
    const r = await cloudinary.uploader.upload(tinyPng, { resource_type: type, folder: "test" });
    console.log(type, "-> UPLOAD OK:", r.secure_url);
  } catch (e) {
    console.log(type, "-> UPLOAD FAILED:", e.http_code, e.message);
  }
}