import express from "express";
import { register, verifyEmail, login, logout, getMe } from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.get("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", protect, getMe);

export default router;