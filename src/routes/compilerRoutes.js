import express from "express";
import { runCode } from "../controllers/compilerController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.post("/run", runCode);

export default router;
