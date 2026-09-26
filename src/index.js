import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import leetcodeRoutes from "./routes/leetcodeRoutes.js";
import connectDB from "./config/db.js";
import compilerRoutes from "./routes/compilerRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import { setupSockets } from "./sockets/socketHandler.js";

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Essential middlewares
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/leetcode", leetcodeRoutes);
app.use("/api/compiler", compilerRoutes);

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running smoothly!" });
});

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  },
});

// Initialize socket events
setupSockets(io);

// Note: Use server.listen instead of app.listen!
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});