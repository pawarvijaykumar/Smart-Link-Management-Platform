
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: "./public/temp",

  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${path.basename(file.originalname)}`;
    cb(null, uniqueName);//cb means callback funtion just is tell that is null meanns not error and when u uploaded the file name ex--vijay.jpg after that it change to 1760123456789-vijay.jpg just is say that uniue name
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024///means 5MB
  }
});

//iske throghut hum api ko test karte hai from postman
/*
Postman
Sends an image as form data
      
Multer middleware
Saves the image temporarily

Controller
Passes the file path to Cloudinary
*/