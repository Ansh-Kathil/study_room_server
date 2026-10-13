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

// In-memory store for active WebRTC voice/video call participants:
// { [roomId]: Map(socketId -> { socketId, userId, name, micMuted, camOff }) }
const roomCallParticipants = new Map();

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

        // If room has an active LeetCode problem, sync it to the newcomer
        if (room.activeProblem) {
          socket.emit("problem_selected", { problem: room.activeProblem });
        }

        // If room has whiteboard drawings, sync them to the newcomer
        if (room.whiteboard && room.whiteboard.length > 0) {
          socket.emit("whiteboard_init", { elements: room.whiteboard });
        }

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

    socket.on("select_problem", async ({ roomId, problem }) => {
      try {
        // Broadcast selected problem to everyone in the room (except sender)
        socket.to(roomId).emit("problem_selected", { problem });

        // Save active LeetCode problem into MongoDB Room document
        await Room.findByIdAndUpdate(roomId, { activeProblem: problem });
      } catch (err) {
        console.error("Error saving selected problem:", err.message);
      }
    });

    // EVENT: peer_typing (Real-time collaborative typing indicator)
    socket.on("peer_typing", ({ roomId, isTyping }) => {
      socket.to(roomId).emit("peer_typing_update", {
        userId: socket.user._id,
        name: socket.user.name,
        isTyping,
      });
    });

    // ==========================================
    // 🎨 REAL-TIME COLLABORATIVE WHITEBOARD
    // ==========================================
    socket.on("whiteboard_draw", async ({ roomId, element }) => {
      // Broadcast new stroke/shape to everyone in room (except sender)
      socket.to(roomId).emit("whiteboard_stroke", { element });

      // Persist to room in MongoDB
      try {
        await Room.findByIdAndUpdate(roomId, {
          $push: { whiteboard: element },
        });
      } catch (err) {
        console.error("Error saving whiteboard element:", err.message);
      }
    });

    socket.on("whiteboard_clear", async ({ roomId }) => {
      // Broadcast clear to room
      socket.to(roomId).emit("whiteboard_cleared");

      // Reset whiteboard array in DB
      try {
        await Room.findByIdAndUpdate(roomId, { whiteboard: [] });
      } catch (err) {
        console.error("Error clearing whiteboard:", err.message);
      }
    });

    socket.on("whiteboard_undo", async ({ roomId, elements }) => {
      // Broadcast updated elements array after undo to room
      socket.to(roomId).emit("whiteboard_sync", { elements });

      try {
        await Room.findByIdAndUpdate(roomId, { whiteboard: elements });
      } catch (err) {
        console.error("Error syncing whiteboard undo:", err.message);
      }
    });

    // Client requests current whiteboard state on demand (e.g. latecomer or tab switch)
    socket.on("whiteboard_request_sync", async ({ roomId }) => {
      try {
        const room = await Room.findById(roomId);
        if (room && Array.isArray(room.whiteboard)) {
          socket.emit("whiteboard_init", { elements: room.whiteboard });
        }
      } catch (err) {
        console.error("Error sending whiteboard state on request:", err.message);
      }
    });

    // ==========================================
    // ⏱️ SYNCHRONIZED MOCK INTERVIEW TIMER
    // ==========================================
    socket.on("mock_timer_action", ({ roomId, action, timeLeft, totalTime, isRunning, presetName }) => {
      socket.to(roomId).emit("mock_timer_sync", {
        action,
        timeLeft,
        totalTime,
        isRunning,
        presetName,
        senderName: socket.user?.name || "Peer",
        timestamp: Date.now(),
      });
    });

    // ==========================================
    // 🎉 ACCEPTED SOLUTION CELEBRATION
    // ==========================================
    socket.on("celebrate_accepted", ({ roomId, problemTitle }) => {
      socket.to(roomId).emit("peer_celebrate_accepted", {
        userName: socket.user?.name || "A peer",
        problemTitle: problemTitle || "the problem",
      });
    });

    // ==========================================
    // 🎙️ WEBRTC MESH AUDIO / VIDEO SIGNALING
    // ==========================================

    // Join voice/video call in this room
    socket.on("webrtc_join_call", ({ roomId, micMuted = false, camOff = false }) => {
      try {
        if (!roomCallParticipants.has(roomId)) {
          roomCallParticipants.set(roomId, new Map());
        }
        const callMap = roomCallParticipants.get(roomId);

        // Get list of existing peers currently in this call
        const existingPeers = Array.from(callMap.values());

        // Save current user's call state
        callMap.set(socket.id, {
          socketId: socket.id,
          userId: socket.user._id,
          name: socket.user.name,
          micMuted,
          camOff,
        });

        // 1. Send the list of existing peers back to newcomer
        socket.emit("webrtc_existing_peers", { peers: existingPeers });

        // 2. Notify all existing peers in the room that a newcomer has joined the call
        socket.to(roomId).emit("webrtc_peer_joined", {
          socketId: socket.id,
          userId: socket.user._id,
          name: socket.user.name,
          micMuted,
          camOff,
        });

        console.log(`📹 ${socket.user.name} joined call in room: ${roomId}`);
      } catch (err) {
        console.error("webrtc_join_call error:", err);
      }
    });

    // Relay SDP Offer to a specific peer
    socket.on("webrtc_signal_offer", ({ targetSocketId, offer }) => {
      io.to(targetSocketId).emit("webrtc_receive_offer", {
        callerSocketId: socket.id,
        callerUserId: socket.user._id,
        callerName: socket.user.name,
        offer,
      });
    });

    // Relay SDP Answer back to caller
    socket.on("webrtc_signal_answer", ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit("webrtc_receive_answer", {
        senderSocketId: socket.id,
        answer,
      });
    });

    // Relay ICE Candidate to target peer
    socket.on("webrtc_ice_candidate", ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit("webrtc_ice_candidate", {
        senderSocketId: socket.id,
        candidate,
      });
    });

    // Relay Mic / Camera toggle status
    socket.on("webrtc_media_status", ({ roomId, micMuted, camOff }) => {
      if (roomCallParticipants.has(roomId)) {
        const callMap = roomCallParticipants.get(roomId);
        if (callMap.has(socket.id)) {
          const userState = callMap.get(socket.id);
          userState.micMuted = micMuted;
          userState.camOff = camOff;
        }
      }
      socket.to(roomId).emit("webrtc_peer_status_changed", {
        socketId: socket.id,
        micMuted,
        camOff,
      });
    });

    // User explicitly leaves voice/video call
    socket.on("webrtc_leave_call", ({ roomId }) => {
      handleUserLeavingCall(socket, roomId);
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

  // Helper function to remove user from voice/video call
  function handleUserLeavingCall(socket, roomId) {
    if (roomCallParticipants.has(roomId)) {
      const callMap = roomCallParticipants.get(roomId);
      if (callMap.has(socket.id)) {
        callMap.delete(socket.id);
        if (callMap.size === 0) {
          roomCallParticipants.delete(roomId);
        }
        socket.to(roomId).emit("webrtc_peer_left", {
          socketId: socket.id,
          userId: socket.user?._id,
          name: socket.user?.name,
        });
        console.log(`👋 ${socket.user?.name} left call in room: ${roomId}`);
      }
    }
  }

  // Helper function to remove user from presence roster and alert room
  function handleUserLeaving(socket, roomId) {
    handleUserLeavingCall(socket, roomId);
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