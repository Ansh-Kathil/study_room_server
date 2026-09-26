import bcrypt from "bcryptjs";
import Room from "../models/Room.js";
import Message from "../models/Message.js";
import { generateRoomCode } from "../utils/generateRoomCode.js";
import { sendRoomInviteEmail } from "../utils/sendEmail.js";

// @desc    Create a new study room
// @route   POST /api/rooms
// @desc    Create a new study room (optional password)
// @route   POST /api/rooms
export const createRoom = async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Room name is required" });
    }

    // Generate unique code
    let joinCode;
    let isUnique = false;
    while (!isUnique) {
      joinCode = generateRoomCode();
      const existing = await Room.findOne({ joinCode });
      if (!existing) isUnique = true;
    }

    // Handle password hashing if room is private
    let hashedPassword = null;
    let isPrivate = false;

    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password.trim(), salt);
      isPrivate = true;
    }

    const room = await Room.create({
      name,
      joinCode,
      owner: req.user._id,
      members: [req.user._id],
      isPrivate,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "Room created successfully",
      room: {
        _id: room._id,
        name: room.name,
        joinCode: room.joinCode,
        isPrivate: room.isPrivate,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all rooms current user is a member of
// @route   GET /api/rooms
export const getUserRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.user._id })
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ rooms });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get details of a single room
// @route   GET /api/rooms/:id
export const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;

    const room = await Room.findById(id)
      .populate("owner", "name email")
      .populate("members", "name email");

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Security check: Verify user is actually a member of this room
    const isMember = room.members.some(
      (member) => member._id.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: "Access denied. You are not a member of this room." });
    }

    res.status(200).json({ room });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Join a room using its 6-character join code
// @route   POST /api/rooms/join
// @desc    Join a room using its 6-character join code (and password if private)
// @route   POST /api/rooms/join
export const joinRoomByCode = async (req, res) => {
  try {
    const { joinCode, password } = req.body;

    if (!joinCode) {
      return res.status(400).json({ message: "Join code is required" });
    }

    const formattedCode = joinCode.trim().toUpperCase();
    const room = await Room.findOne({ joinCode: formattedCode });

    if (!room) {
      return res.status(404).json({ message: "Invalid room code. Room not found." });
    }

    // 🔐 If room is private, verify password
    if (room.isPrivate) {
      if (!password) {
        return res.status(400).json({
          requiresPassword: true,
          message: "This room is password-protected. Please enter the password.",
        });
      }

      const isMatch = await bcrypt.compare(password, room.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Incorrect room password" });
      }
    }

    // Add user to members atomically
    await Room.findByIdAndUpdate(room._id, {
      $addToSet: { members: req.user._id },
    });

    res.status(200).json({
      message: "Joined room successfully",
      roomId: room._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Leave a study room
// @route   DELETE /api/rooms/:id/leave
export const leaveRoom = async (req, res) => {
  try {
    const { id } = req.params;

    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Remove user from members array
    await Room.findByIdAndUpdate(id, {
      $pull: { members: req.user._id },
    });

    res.status(200).json({ message: "Left the room successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Get all chat messages for a room
// @route   GET /api/rooms/:id/messages
export const getRoomMessages = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the room exists
    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Security check: Only room members can view messages
    const isMember = room.members.some(
      (memberId) => memberId.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: "Access denied. You are not a member of this room." });
    }

    // Fetch messages sorted oldest to newest, populating the sender's name and email
    const messages = await Message.find({ room: id })
      .populate("sender", "name email")
      .sort({ createdAt: 1 });

    res.status(200).json({ messages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Invite a peer to the room via email
// @route   POST /api/rooms/:id/invite
export const inviteToRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Recipient email is required" });
    }

    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Verify inviter is actually a member
    const isMember = room.members.some(
      (m) => m.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: "You must be a member to invite others" });
    }

    // Send invitation email simulation
    await sendRoomInviteEmail(email.trim(), room, req.user.name);

    res.status(200).json({
      message: `Invitation successfully sent to ${email}`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};