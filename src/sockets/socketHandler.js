import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Room from "../models/Room.js";
import Message from "../models/Message.js";

// Helper to parse cookies from raw socket handshake header string
const parseCookieString = (cookieString) => {
  if (!cookieString) return {};
  return Object.fromEntries(
    cookieString.split(/;\s*/).map((c) => {
      const [key, ...v] = c.split("=");
      return [key.trim(), decodeURIComponent(v.join("="))];
    })
  );
};


// In-memory store to track online users: { [roomId]: [{ socketId, userId, name }] }
const roomOnlineUsers = new Map();

export const setupSockets = (io) => {
  // 1. Socket Authentication Middleware (runs on handshake)
  io.use(async (socket, next) => {
    try {
      const rawCookies = socket.handshake.headers.cookie;
      const cookies = parseCookieString(rawCookies);
      const token = cookies.token;

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      // Attach authenticated user to socket instance
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  // 2. Connection Handler
  io.on("connection", (socket) => {
    console.log(`⚡ User connected: ${socket.user.name} (${socket.id})`);

    // EVENT: join_room
    socket.on("join_room", async ({ roomId }) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) {
          return socket.emit("error", { message: "Room not found" });
        }

        // Verify membership
        const isMember = room.members.some(
          (m) => m.toString() === socket.user._id.toString()
        );
        if (!isMember) {
          return socket.emit("error", { message: "Not authorized for this room" });
        }

        // Join Socket.IO room
        socket.join(roomId);
        socket.currentRoomId = roomId;

        // Update in-memory online roster
        if (!roomOnlineUsers.has(roomId)) {
          roomOnlineUsers.set(roomId, new Map());
        }
        const roomUsers = roomOnlineUsers.get(roomId);
        roomUsers.set(socket.user._id.toString(), {
          userId: socket.user._id,
          name: socket.user.name,
        });

        const onlineList = Array.from(roomUsers.values());

        // Notify others in room that a user joined
        socket.to(roomId).emit("user_joined", {
          userId: socket.user._id,
          name: socket.user.name,
        });

        // Broadcast updated online roster to everyone in this room
        io.to(roomId).emit("online_users", onlineList);

        console.log(`👤 ${socket.user.name} joined room: ${room.name}`);
      } catch (err) {
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // EVENT: send_message
    socket.on("send_message", async ({ roomId, content }) => {
      try {
        if (!content || !content.trim()) return;

        // Save message to MongoDB
        const message = await Message.create({
          room: roomId,
          sender: socket.user._id,
          content: content.trim(),
        });

        // Populate sender details
        await message.populate("sender", "name email");

        // Broadcast to ALL users in the room (including sender)
        io.to(roomId).emit("new_message", message);
      } catch (err) {
        socket.emit("error", { message: "Failed to send message" });
      }
    });

        // EVENT: code_change (Real-time collaborative typing)
    socket.on("code_change", async ({ roomId, code }) => {
      try {
        // Broadcast the new code to ALL other users in the room (except sender)
        socket.to(roomId).emit("code_update", { code });

        // Auto-save code snapshot to MongoDB Room document
        await Room.findByIdAndUpdate(roomId, { code });
      } catch (err) {
        console.error("Error syncing code:", err.message);
      }
    });

    // EVENT: language_change (Sync language switch)
    socket.on("language_change", async ({ roomId, language }) => {
      try {
        // Broadcast language change to everyone in the room (except sender)
        socket.to(roomId).emit("language_update", { language });

        // Update room document in MongoDB
        await Room.findByIdAndUpdate(roomId, { language });
      } catch (err) {
        console.error("Error syncing language:", err.message);
      }
    });

        // EVENT: notes_change (Real-time shared notes)
    socket.on("notes_change", async ({ roomId, notes }) => {
      try {
        // Broadcast notes to all other users in the room
        socket.to(roomId).emit("notes_update", { notes });

        // Save notes to MongoDB
        await Room.findByIdAndUpdate(roomId, { notes });
      } catch (err) {
        console.error("Error syncing notes:", err.message);
      }
    });

     socket.on("select_problem", ({ roomId, problem }) => {
      // Broadcast selected problem to everyone in the room (except sender)
      socket.to(roomId).emit("problem_selected", { problem });
    });

    // EVENT: leave_room
    socket.on("leave_room", ({ roomId }) => {
      handleUserLeaving(socket, roomId);
    });

    // EVENT: disconnect
    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.user.name} (${socket.id})`);
      if (socket.currentRoomId) {
        handleUserLeaving(socket, socket.currentRoomId);
      }
    });
  });

  // Helper function to remove user from presence roster and alert room
  function handleUserLeaving(socket, roomId) {
    socket.leave(roomId);

    if (roomOnlineUsers.has(roomId)) {
      const roomUsers = roomOnlineUsers.get(roomId);
      roomUsers.delete(socket.user._id.toString());

      if (roomUsers.size === 0) {
        roomOnlineUsers.delete(roomId);
      } else {
        io.to(roomId).emit("online_users", Array.from(roomUsers.values()));
      }
    }

    socket.to(roomId).emit("user_left", {
      userId: socket.user._id,
      name: socket.user.name,
    });
  }
};