// server.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import ecommerceRoutes from "./routes/ecommerceRoutes.js";

dotenv.config();

const app = express();

// -------------------------------------------------------------
// Security & core middlewares
// -------------------------------------------------------------
app.use(helmet()); // adds basic security headers

// CORS (allow all for now — can restrict later)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// Request body parsers with limits
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Logging
app.use(morgan("dev"));

// -------------------------------------------------------------
// Connect Database
// -------------------------------------------------------------
connectDB();

// -------------------------------------------------------------
// Health endpoints
// -------------------------------------------------------------
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "E-Commerce Copilot Backend Running" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// -------------------------------------------------------------
// API routes
// -------------------------------------------------------------
app.use("/api", ecommerceRoutes);

// -------------------------------------------------------------
// Unified error handler (optional, improves debugging)
// -------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message,
  });
});

// -------------------------------------------------------------
// Start server
// -------------------------------------------------------------
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// -------------------------------------------------------------
// Graceful shutdown for Render / Railway / Docker
// -------------------------------------------------------------
process.on("SIGINT", () => {
  console.log("🛑 Server shutting down...");
  server.close(() => {
    console.log("🔌 HTTP server closed.");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down...");
  server.close(() => {
    console.log("🔌 HTTP server closed.");
    process.exit(0);
  });
});
