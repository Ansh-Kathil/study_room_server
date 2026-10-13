import nodemailer from "nodemailer";
import { Resend } from "resend";

const getResendClient = () => {
  if (process.env.RESEND_API_KEY) {
    return new Resend(process.env.RESEND_API_KEY);
  }
  return null;
};

// Create reusable SMTP transporter as fallback for local dev
const createSmtpTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 8000,
  });
};

const getBaseClientUrl = () => {
  const raw = process.env.CLIENT_URL || "http://localhost:3000";
  return raw.split(",")[0].trim().replace(/\/+$/, "");
};

// 📧 1. Send Account Verification Email
export const sendVerificationEmail = async (email, token) => {
  const baseUrl = getBaseClientUrl();
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  const resend = getResendClient();

  const emailSubject = "Verify Your Study Room Account 🎓";
  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #020617; padding: 40px 20px; color: #f8fafc;">
      <div style="max-width: 500px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; text-align: center;">
        <h1 style="color: #818cf8; font-size: 24px; margin-bottom: 8px;">Collaborative Study Room</h1>
        <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;">Welcome to your virtual peer-learning workspace.</p>
        
        <div style="padding: 24px; background-color: #020617; border-radius: 12px; margin-bottom: 24px;">
          <p style="font-size: 15px; color: #e2e8f0; line-height: 1.6; margin-bottom: 20px;">
            Please click the button below to verify your email address and activate your account.
          </p>
          <a href="${verificationUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 10px; font-weight: 600; text-decoration: none; font-size: 14px;">
            Verify My Account →
          </a>
        </div>

        <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
          This link will expire in 1 hour. If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;

  // Method 1: Use Resend REST API (HTTPS port 443 — NEVER blocked by Render)
  if (resend) {
    try {
      const fromSender = process.env.EMAIL_FROM || "Collaborative Study Room <onboarding@resend.dev>";
      const result = await resend.emails.send({
        from: fromSender,
        to: email,
        subject: emailSubject,
        html: emailHtml,
      });

      if (result.error) {
        console.error(`❌ [RESEND API ERROR]: ${result.error.message}`);
        console.log(`💡 [MANUAL VERIFICATION LINK]: ${verificationUrl}`);
      } else {
        console.log(`✅ [EMAIL DISPATCHED VIA RESEND TO]: ${email} (ID: ${result.data?.id})`);
      }
      return;
    } catch (err) {
      console.error(`❌ [RESEND DISPATCH FAILED]: ${err.message}`);
      console.log(`💡 [MANUAL VERIFICATION LINK]: ${verificationUrl}`);
      return;
    }
  }

  // Method 2: Fallback to Nodemailer SMTP
  const transporter = createSmtpTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Collaborative Study Room" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: emailSubject,
        html: emailHtml,
      });
      console.log(`✅ [EMAIL DISPATCHED VIA SMTP TO]: ${email}`);
      return;
    } catch (err) {
      console.error(`❌ [SMTP DISPATCH FAILED]: ${err.message}`);
      console.log(`💡 [MANUAL VERIFICATION LINK]: ${verificationUrl}`);
      return;
    }
  }

  // Method 3: Development / Offline Console fallback
  console.log("\n=======================================================");
  console.log(`📧 [EMAIL SENT TO]: ${email}`);
  console.log(`🔗 [VERIFY LINK]: ${verificationUrl}`);
  console.log("=======================================================\n");
};

// 📧 2. Send Study Room Invitation Email
export const sendRoomInviteEmail = async (recipientEmail, room, inviterName) => {
  const baseUrl = getBaseClientUrl();
  const joinUrl = `${baseUrl}/dashboard?joinCode=${room.joinCode}`;
  const resend = getResendClient();

  const emailSubject = `You're invited to join "${room.name}" on Study Room 📚`;
  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #020617; padding: 40px 20px; color: #f8fafc;">
      <div style="max-width: 500px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; text-align: center;">
        <h1 style="color: #818cf8; font-size: 24px; margin-bottom: 8px;">Study Room Invitation</h1>
        <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;">
          <strong style="color: #f8fafc;">${inviterName}</strong> invited you to collaborate in their study room!
        </p>
        
        <div style="padding: 24px; background-color: #020617; border-radius: 12px; margin-bottom: 24px;">
          <p style="font-size: 13px; color: #94a3b8; margin-bottom: 6px;">Room Name</p>
          <h2 style="font-size: 18px; color: #f8fafc; margin-bottom: 16px;">${room.name}</h2>

          <p style="font-size: 13px; color: #94a3b8; margin-bottom: 6px;">Join Code</p>
          <div style="display: inline-block; background-color: #1e1b4b; border: 1px dashed #6366f1; border-radius: 8px; padding: 8px 20px; font-family: monospace; font-size: 20px; font-weight: bold; color: #a5b4fc; letter-spacing: 3px; margin-bottom: 20px;">
            ${room.joinCode}
          </div>

          <div>
            <a href="${joinUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 10px; font-weight: 600; text-decoration: none; font-size: 14px;">
              Join Study Room →
            </a>
          </div>
        </div>

        <p style="font-size: 12px; color: #64748b;">
          Collaborative code editing, live chat, shared notes, and LeetCode problem solving.
        </p>
      </div>
    </div>
  `;

  if (resend) {
    try {
      const fromSender = process.env.EMAIL_FROM || "Collaborative Study Room <onboarding@resend.dev>";
      await resend.emails.send({
        from: fromSender,
        to: recipientEmail,
        subject: emailSubject,
        html: emailHtml,
      });
      console.log(`✅ [INVITATION DISPATCHED VIA RESEND TO]: ${recipientEmail}`);
      return;
    } catch (err) {
      console.error(`❌ [RESEND INVITATION FAILED]: ${err.message}`);
    }
  }

  const transporter = createSmtpTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Collaborative Study Room" <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: emailSubject,
        html: emailHtml,
      });
      console.log(`✅ [INVITATION DISPATCHED VIA SMTP TO]: ${recipientEmail}`);
      return;
    } catch (err) {
      console.error(`❌ [SMTP INVITATION FAILED]: ${err.message}`);
    }
  }
};