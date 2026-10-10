
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,//authenticates your server when uploading images.
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export { cloudinary };
//means of the file this -->Uploads and stores the image online