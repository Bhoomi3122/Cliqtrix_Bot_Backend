// config/db.js
import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not set in .env");
    }

    // Prevent deprecation warnings
    mongoose.set("strictQuery", false);

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      autoIndex: true,            // ensure indexes are created
      maxPoolSize: 5,             // optimal for Render/Heroku
      serverSelectionTimeoutMS: 10000,  // fail fast if DB not reachable
      socketTimeoutMS: 45000,     // avoid hanging sockets
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("🛑 MongoDB disconnected through app termination");
      process.exit(0);
    });

  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  }
};
