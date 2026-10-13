import jwt from "jsonwebtoken";

export const generateTokenAndSetCookie = (res, userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d", // Token valid for 7 days
  });

  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.CLIENT_URL && !process.env.CLIENT_URL.includes("localhost"));

  res.cookie("token", token, {
    httpOnly: true, // Prevents JavaScript (XSS attacks) from reading the cookie
    secure: isProduction, // HTTPS only in production / cross-site
    sameSite: isProduction ? "none" : "lax", // 'none' is mandatory for cross-origin cookies between Vercel and Render
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  });

  return token;
};