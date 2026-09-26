import jwt from "jsonwebtoken";

export const generateTokenAndSetCookie = (res, userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d", // Token valid for 7 days
  });

  res.cookie("token", token, {
    httpOnly: true, // Prevents JavaScript (XSS attacks) from reading the cookie
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "lax", // Protects against CSRF
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  });

  return token;
};