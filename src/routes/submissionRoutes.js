import express from "express";
import {
  createSubmission,
  getUserSubmissions,
  getUserStats,
  getRoomSubmissions,
} from "../controllers/submissionController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createSubmission);
router.get("/user", getUserSubmissions);
router.get("/stats", getUserStats);
router.get("/room/:roomId", getRoomSubmissions);

export default router;
