
require("dotenv").config();

const fs = require("fs");
const path = require("path");

async function testUpload() {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    const imagePath = path.join(
      __dirname,
      "public",
      "temp",
      "1791641037271-vijay.jpg"
    );

    const imageBuffer = fs.readFileSync(imagePath);
    const formData = new FormData();

    formData.append(
      "file",
      new Blob([imageBuffer]),
      "vijay.jpg"
    );

    const credentials = Buffer.from(
      `${apiKey}:${apiSecret}`
    ).toString("base64");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
        },
        body: formData,
      }
    );

    console.log("HTTP status:", response.status);
    console.log(
      "Cloudinary error header:",
      response.headers.get("X-Cld-Error")
    );
    console.log("Response body:", await response.text());
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

testUpload();
