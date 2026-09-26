import express from "express";
import {
  createRoom,
  getUserRooms,
  getRoomById,
  joinRoomByCode,
  leaveRoom,
  inviteToRoom,
  getRoomMessages, 
} from "../controllers/roomController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Apply protect middleware to ALL room routes below
router.use(protect);

router.post("/", createRoom);
router.get("/", getUserRooms);
router.post("/join", joinRoomByCode);
router.get("/:id", getRoomById);
router.delete("/:id/leave", leaveRoom);
router.get("/:id/messages", getRoomMessages);
router.post("/:id/invite", inviteToRoom);

export default router;