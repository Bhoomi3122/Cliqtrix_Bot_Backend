// server.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import ecommerceRoutes from "./routes/ecommerceRoutes.js";

dotenv.config();

const app = express();

// Middlewares
app.use(cors());            // you can restrict origins later if needed
app.use(express.json());
app.use(morgan("dev"));

// DB
connectDB();

// Health check
app.get("/", (req, res) => {
  res.send("E-Commerce Copilot Backend Running ✅");
});

// API routes
app.use("/api", ecommerceRoutes);

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
