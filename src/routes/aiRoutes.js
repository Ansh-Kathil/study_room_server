import express from "express";
import { aiCoachHandler } from "../controllers/aiController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// POST /api/ai/coach (Protected endpoint)
router.post("/coach", protect, aiCoachHandler);

export default router;
