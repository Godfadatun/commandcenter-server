import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { AppDataSource } from "../data-source";
import { User } from "../entities/User";
import { Verification } from "../entities/Verification";
import { hashPassword, comparePassword, signToken } from "../services/auth.service";
import { generateCode } from "../utils/generateCode";

const userRepo = () => AppDataSource.getRepository(User);
const verRepo = () => AppDataSource.getRepository(Verification);

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({ error: "All fields required: firstName, lastName, email, password" });
      return;
    }
    const existing = await userRepo().findOne({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    const user = userRepo().create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: await hashPassword(password),
      status: "INACTIVE",
      verificationStatus: "UNVERIFIED",
    });
    await userRepo().save(user);

    // Create verification record
    const verification = verRepo().create({
      userId: user.id,
      event: "VERIFY_EMAIL",
      status: "ACTIVE",
      verificationStatus: "UNVERIFIED",
      token: Math.floor(100000 + Math.random() * 900000).toString(), // 6-digit OTP
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });
    await verRepo().save(verification);

    res.status(201).json({
      ok: true,
      user: { code: user.code, firstName: user.firstName, lastName: user.lastName, email: user.email },
      verificationCode: verification.code,
      // In production, send OTP via email instead of returning it
      otp: verification.token,
    });
  } catch (e: any) {
    console.error("Register error:", e.message);
    res.status(500).json({ error: e.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    const user = await userRepo().findOne({ where: { email: email.toLowerCase() } });
    if (!user || user.status === "DELETED") {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await comparePassword(password, user.password);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = signToken({ id: user.id, email: user.email, code: user.code });
    res.json({
      ok: true,
      token,
      user: { code: user.code, firstName: user.firstName, lastName: user.lastName, email: user.email, status: user.status, verificationStatus: user.verificationStatus },
    });
  } catch (e: any) {
    console.error("Login error:", e.message);
    res.status(500).json({ error: e.message });
  }
};

export const verify = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400).json({ error: "Email and OTP required" });
      return;
    }
    const user = await userRepo().findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // Accept 000000 as universal OTP in non-production environments
    const isDevBypass = process.env.NODE_ENV !== "production" && otp === "000000";
    const verification = await verRepo().findOne({
      where: { userId: user.id, event: "VERIFY_EMAIL", status: "ACTIVE", ...(isDevBypass ? {} : { token: otp }) },
    });
    if (!verification || (!isDevBypass && new Date() > verification.expiresAt)) {
      res.status(400).json({ error: "Invalid or expired OTP" });
      return;
    }
    verification.status = "INACTIVE";
    verification.verificationStatus = "VERIFIED";
    await verRepo().save(verification);

    user.status = "ACTIVE";
    user.verificationStatus = "VERIFIED";
    await userRepo().save(user);

    const token = signToken({ id: user.id, email: user.email, code: user.code });
    res.json({ ok: true, token, user: { code: user.code, firstName: user.firstName, email: user.email, status: user.status } });
  } catch (e: any) {
    console.error("Verify error:", e.message);
    res.status(500).json({ error: e.message });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email required" });
      return;
    }
    const user = await userRepo().findOne({ where: { email: email.toLowerCase() } });
    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ ok: true, message: "If an account exists, a reset code has been sent" });
      return;
    }
    // Create reset verification
    const verification = verRepo().create({
      userId: user.id,
      event: "FORGOT_PASSWORD",
      status: "ACTIVE",
      verificationStatus: "UNVERIFIED",
      token: Math.floor(100000 + Math.random() * 900000).toString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });
    await verRepo().save(verification);

    // In production, send email with OTP. For now, return it.
    console.log(`Password reset OTP for ${email}: ${verification.token}`);
    res.json({
      ok: true,
      message: "If an account exists, a reset code has been sent",
      // Remove in production — only for dev/testing
      ...(process.env.NODE_ENV !== "production" ? { otp: verification.token } : {}),
    });
  } catch (e: any) {
    console.error("Forgot password error:", e.message);
    res.status(500).json({ error: e.message });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      res.status(400).json({ error: "Email, OTP, and new password required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }
    const user = await userRepo().findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      res.status(400).json({ error: "Invalid reset request" });
      return;
    }
    // Dev bypass: accept 000000
    const isDevBypass = process.env.NODE_ENV !== "production" && otp === "000000";
    const verification = await verRepo().findOne({
      where: { userId: user.id, event: "FORGOT_PASSWORD", status: "ACTIVE", ...(isDevBypass ? {} : { token: otp }) },
    });
    if (!verification || (!isDevBypass && new Date() > verification.expiresAt)) {
      res.status(400).json({ error: "Invalid or expired reset code" });
      return;
    }
    // Update password
    user.password = await hashPassword(password);
    await userRepo().save(user);

    // Invalidate the verification
    verification.status = "INACTIVE";
    verification.verificationStatus = "VERIFIED";
    await verRepo().save(verification);

    res.json({ ok: true, message: "Password reset successfully" });
  } catch (e: any) {
    console.error("Reset password error:", e.message);
    res.status(500).json({ error: e.message });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current password and new password required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }
    const user = await userRepo().findOne({ where: { id: req.user!.id } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    user.password = await hashPassword(newPassword);
    await userRepo().save(user);
    res.json({ ok: true, message: "Password changed successfully" });
  } catch (e: any) {
    console.error("Change password error:", e.message);
    res.status(500).json({ error: e.message });
  }
};
