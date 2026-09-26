import express from "express";
import { searchProblems, getProblemDetails } from "../controllers/leetcodeController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/search", searchProblems);
router.get("/:slug", getProblemDetails);

export default router;