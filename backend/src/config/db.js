import mongoose from "mongoose";

const connectDB = async () => {
  const remoteUri = process.env.MONGO_URI;
  const localUri = process.env.LOCAL_MONGO_URI || "mongodb://127.0.0.1:27017/smartlink";

  if (remoteUri) {
    try {
      console.log("Connecting to primary MongoDB URI...");
      await mongoose.connect(remoteUri, { serverSelectionTimeoutMS: 4000 });
      console.log("MongoDB connected successfully to primary database");
      return;
    } catch (error) {
      console.warn(`Primary MongoDB connection failed (${error.message}). Falling back to local MongoDB...`);
    }
  }

  try {
    await mongoose.connect(localUri, { serverSelectionTimeoutMS: 4000 });
    console.log(`MongoDB connected successfully to local database (${localUri})`);
  } catch (localError) {
    console.error("Local MongoDB connection also failed:", localError.message);
    process.exit(1);
  }
};

export default connectDB;