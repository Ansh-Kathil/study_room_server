import nodemailer from "nodemailer";

// Create reusable transporter with explicit SSL and timeout handling for cloud hosts like Render
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null; // Fallback to console if credentials not provided
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Use SSL on port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 5000,
    socketTimeout: 10000,
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
  const transporter = createTransporter();

  // If EMAIL_USER is not configured in .env, log to console
  if (!transporter) {
    console.log("\n=======================================================");
    console.log(`📧 [EMAIL SENT TO]: ${email}`);
    console.log(`🔗 [VERIFY LINK]: ${verificationUrl}`);
    console.log("=======================================================\n");
    return;
  }

  const mailOptions = {
    from: `"Collaborative Study Room" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify Your Study Room Account 🎓",
    html: `
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
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ [EMAIL DISPATCHED TO]: ${email}`);
  } catch (err) {
    console.error(`❌ [EMAIL DISPATCH FAILED]: ${err.message}`);
    console.log(`💡 [MANUAL VERIFICATION LINK]: ${verificationUrl}`);
  }
};

// 📧 2. Send Study Room Invitation Email
export const sendRoomInviteEmail = async (recipientEmail, room, inviterName) => {
  const baseUrl = getBaseClientUrl();
  const joinUrl = `${baseUrl}/dashboard?joinCode=${room.joinCode}`;
  const transporter = createTransporter();

  if (!transporter) {
    console.log("\n=======================================================");
    console.log(`📬 [INVITATION SENT TO]: ${recipientEmail}`);
    console.log(`👤 [INVITED BY]: ${inviterName}`);
    console.log(`📚 [ROOM]: ${room.name} (Code: ${room.joinCode})`);
    console.log(`🔗 [JOIN LINK]: ${joinUrl}`);
    console.log("=======================================================\n");
    return;
  }

  const mailOptions = {
    from: `"Collaborative Study Room" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: `You're invited to join "${room.name}" on Study Room 📚`,
    html: `
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
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ [INVITATION DISPATCHED TO]: ${recipientEmail}`);
  } catch (err) {
    console.error(`❌ [INVITATION DISPATCH FAILED]: ${err.message}`);
  }
};