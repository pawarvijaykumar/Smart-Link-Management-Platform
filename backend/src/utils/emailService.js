// CHANGE: Added password recovery — 2026-10-20
import nodemailer from "nodemailer";

let transporter = null;

/**
 * Returns a configured Nodemailer transporter if SMTP environment variables are present.
 */
const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }
  return transporter;
};

/**
 * Sends a password reset email with a time-limited single-use reset link.
 * Does not expose secrets or credentials in logs.
 *
 * @param {string} toEmail - Recipient email
 * @param {string} username - Recipient username
 * @param {string} resetToken - Cryptographically secure unhashed reset token
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
export const sendPasswordResetEmail = async (toEmail, username, resetToken) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetLink = `${frontendUrl}/?resetToken=${resetToken}`;

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    // If SMTP is not yet configured, log an informational instruction without exposing tokens or secrets
    console.info(
      `[EmailService] SMTP credentials not configured in backend/.env. Password reset email queued for ${toEmail}. Set SMTP_HOST, SMTP_USER, SMTP_PASS to send real emails.`
    );
    return { sent: false, reason: "smtp_not_configured", resetLink };
  }

  const fromAddress = process.env.SMTP_FROM || `"SmartLink Support" <${process.env.SMTP_USER}>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 16px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #111827; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
                <!-- Header -->
                <tr>
                  <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                    <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #ffffff; font-size: 22px; font-weight: bold; border-radius: 10px; text-align: center; margin-bottom: 12px;">S</div>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">SmartLink</h1>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">Password Reset Request</p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 28px 32px;">
                    <p style="margin: 0 0 14px; font-size: 15px; color: #e2e8f0; line-height: 1.5;">
                      Hello <strong>${username || "there"}</strong>,
                    </p>
                    <p style="margin: 0 0 20px; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                      We received a request to reset your SmartLink account password. Click the button below to choose a new password. This link is single-use and valid for <strong>1 hour</strong>.
                    </p>

                    <div style="text-align: center; margin: 28px 0;">
                      <a href="${resetLink}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);">
                        Reset Password &rarr;
                      </a>
                    </div>

                    <p style="margin: 0 0 8px; font-size: 12px; color: #64748b; line-height: 1.5;">
                      If the button above does not work, copy and paste this URL into your browser:
                    </p>
                    <p style="margin: 0 0 20px; font-size: 12px; color: #a78bfa; word-break: break-all; line-height: 1.4;">
                      ${resetLink}
                    </p>

                    <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                      If you did not request a password reset, you can safely ignore this email. Your current password remains secure.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 16px 32px 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 11px; color: #475569;">
                    SmartLink Platform &bull; Link Management &amp; Real-time Analytics
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await mailTransporter.sendMail({
    from: fromAddress,
    to: toEmail,
    subject: "Reset your SmartLink password",
    text: `Hello ${username || ""},\n\nWe received a request to reset your SmartLink password. Click the link below to set a new password (valid for 1 hour):\n\n${resetLink}\n\nIf you did not request this, you can ignore this email.`,
    html: htmlContent,
  });

  return { sent: true };
};
