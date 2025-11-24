// config/db.js
import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not set in .env");
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // options are optional in modern mongoose
    });

    console.log("✅ MongoDB connected:", conn.connection.host);
  } catch (err) {
    console.error("❌ DB Error:", err.message);
    process.exit(1);
  }
};
