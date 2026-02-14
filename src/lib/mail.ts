import nodemailer from "nodemailer";

export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Nexus VPS" <[EMAIL_ADDRESS]>',
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: %s", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error };
  }
}

export function getOtpHtml(otp: string) {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #000; color: #fff; padding: 40px; border-radius: 12px; max-width: 500px; margin: auto; border: 1px solid #333;">
      <h1 style="color: #ff5722; text-align: center; font-size: 28px; margin-bottom: 30px;">Nexus <span style="color: #fff;">VPS</span></h1>
      <p style="font-size: 16px; line-height: 1.5; color: #ccc;">Hello,</p>
      <p style="font-size: 16px; line-height: 1.5; color: #ccc;">Thank you for joining Nexus VPS. To complete your registration, please use the following One-Time Password (OTP):</p>
      <div style="background-color: #111; border: 1px solid #ff5722; color: #ff5722; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; margin: 30px 0; letter-spacing: 5px;">
        ${otp}
      </div>
      <p style="font-size: 14px; color: #777; text-align: center;">This code will expire in 10 minutes. If you did not request this code, please ignore this email.</p>
      <hr style="border: 0; border-top: 1px solid #222; margin: 30px 0;">
      <p style="font-size: 12px; color: #555; text-align: center;">&copy; ${new Date().getFullYear()} Nexus Cloud Systems. All rights reserved.</p>
    </div>
  `;
}
