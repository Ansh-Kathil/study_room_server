import crypto from "crypto";
import User from "../models/User.js";
import Token from "../models/Token.js";
import { generateTokenAndSetCookie } from "../utils/generateToken.js";
import { sendVerificationEmail } from "../utils/sendEmail.js";

// @desc    Register a new user
// @route   POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Create user (password is automatically hashed by our User pre-save hook)
    const user = await User.create({
      name,
      email,
      password,
    });

    // Generate random 32-byte verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Save token in DB (auto-expires in 1 hour via TTL index)
    await Token.create({
      userId: user._id,
      token: verificationToken,
    });

    // Send email (logs link to terminal console)
    await sendVerificationEmail(user.email, verificationToken);

    res.status(201).json({
      message: "Registration successful! Please check your email to verify your account.",
      userId: user._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify email using token
// @route   GET /api/auth/verify-email
// @desc    Verify email using token
// @route   GET /api/auth/verify-email
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: "Invalid or missing verification token" });
    }

    // Find token in DB
    const tokenDoc = await Token.findOne({ token });
    if (!tokenDoc) {
      return res.status(400).json({
        message: "This verification link has expired or has already been used. You can try logging in.",
      });
    }

    // Check if user is already verified
    const user = await User.findById(tokenDoc.userId);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        message: "Email is already verified! You can now log in.",
      });
    }

    // Mark user as verified
    user.isEmailVerified = true;
    await user.save();

    res.status(200).json({
      message: "Email verified successfully! You can now log in.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please provide email and password" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Use our User model helper to compare bcrypt password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if email has been verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in",
      });
    }

    // Generate JWT and set in HTTP-only cookie
    generateTokenAndSetCookie(res, user._id);

    res.status(200).json({
      message: "Logged in successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout user (clear cookie)
// @route   POST /api/auth/logout
export const logout = (req, res) => {
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.CLIENT_URL && !process.env.CLIENT_URL.includes("localhost"));
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });
  res.status(200).json({ message: "Logged out successfully" });
};

// @desc    Get current user profile
// @route   GET /api/auth/me
export const getMe = async (req, res) => {
  // req.user will be attached by our authMiddleware
  res.status(200).json({ user: req.user });
};