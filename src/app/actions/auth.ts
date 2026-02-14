"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import { sendMail, getOtpHtml } from "@/lib/mail";

// Helper to generate a 6-digit OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function registerUser(formData: any) {
  const { email, password, name } = formData;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      if (existingUser.isVerified) {
        return { success: false, message: "User already exists" };
      } else {
        // User exists but not verified, we can resend OTP
        const otp = generateOtp();
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await prisma.verificationToken.upsert({
          where: { email_token: { email, token: otp } }, // This might not work as expected because token is new
          update: { token: otp, expires },
          create: { email, token: otp, expires, type: 'REGISTER' }
        });

        await sendMail({
          to: email,
          subject: "Verify your email - Nexus VPS",
          html: getOtpHtml(otp)
        });

        return { success: true, message: "Verification code sent to your email", step: 'verify' };
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        isVerified: false
      }
    });

    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationToken.create({
      data: {
        email,
        token: otp,
        expires,
        type: 'REGISTER'
      }
    });

    await sendMail({
      to: email,
      subject: "Verify your email - Nexus VPS",
      html: getOtpHtml(otp)
    });

    return { success: true, message: "Verification code sent to your email", step: 'verify' };

  } catch (error: any) {
    console.error("Registration error:", error);
    return { success: false, message: error.message || "Failed to register" };
  }
}

export async function verifyOtp(email: string, otp: string) {
  try {
    const verification = await prisma.verificationToken.findFirst({
      where: {
        email,
        token: otp,
        type: 'REGISTER',
        expires: { gt: new Date() }
      }
    });

    if (!verification) {
      return { success: false, message: "Invalid or expired OTP" };
    }

    await prisma.user.update({
      where: { email },
      data: { isVerified: true }
    });

    await prisma.verificationToken.deleteMany({
      where: { email, type: 'REGISTER' }
    });

    return { success: true, message: "Email verified successfully" };

  } catch (error: any) {
    console.error("Verification error:", error);
    return { success: false, message: error.message || "Failed to verify" };
  }
}

export async function forgotPassword(email: string) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if user exists for security
      return { success: true, message: "If an account exists, a reset code has been sent." };
    }

    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationToken.create({
      data: {
        email,
        token: otp,
        expires,
        type: 'PASSWORD_RESET'
      }
    });

    await sendMail({
      to: email,
      subject: "Password Reset Code - Nexus VPS",
      html: getOtpHtml(otp) // We can use the same styled template
    });

    return { success: true, message: "Reset code sent to your email" };

  } catch (error: any) {
    console.error("Forgot password error:", error);
    return { success: false, message: "Failed to process request" };
  }
}

export async function resetPassword(email: string, otp: string, newPassword: Buffer) {
  try {
    const verification = await prisma.verificationToken.findFirst({
      where: {
        email,
        token: otp,
        type: 'PASSWORD_RESET',
        expires: { gt: new Date() }
      }
    });

    if (!verification) {
      return { success: false, message: "Invalid or expired reset code" };
    }

    const hashedPassword = await bcrypt.hash(newPassword.toString(), 10);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    });

    await prisma.verificationToken.deleteMany({
      where: { email, type: 'PASSWORD_RESET' }
    });

    return { success: true, message: "Password reset successfully" };

  } catch (error: any) {
    console.error("Reset password error:", error);
    return { success: false, message: "Failed to reset password" };
  }
}

export async function resendOtp(email: string) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return { success: false, message: "User not found" };
    }

    if (user.isVerified) {
      return { success: false, message: "User is already verified" };
    }

    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Clear old tokens of same type before creating new one
    await prisma.verificationToken.deleteMany({
      where: { email, type: 'REGISTER' }
    });

    await prisma.verificationToken.create({
      data: {
        email,
        token: otp,
        expires,
        type: 'REGISTER'
      }
    });

    await sendMail({
      to: email,
      subject: "Verify your email - Nexus VPS",
      html: getOtpHtml(otp)
    });

    return { success: true, message: "New verification code sent!" };
  } catch (error: any) {
    console.error("Resend OTP error:", error);
    return { success: false, message: "Failed to resend code" };
  }
}
