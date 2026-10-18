import express from "express";
import {
  startMockInterview,
  interviewTurn,
  endAndEvaluateInterview,
  getInterviewHistory,
  getInterviewDetail,
} from "../controllers/mockInterviewController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All mock interview endpoints require authentication
router.use(protect);

router.post("/start", startMockInterview);
router.post("/turn", interviewTurn);
router.post("/end", endAndEvaluateInterview);
router.get("/history", getInterviewHistory);
router.get("/:id", getInterviewDetail);

export default router;
