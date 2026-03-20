import { Request, Response } from "express";
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
    const verification = await verRepo().findOne({
      where: { userId: user.id, event: "VERIFY_EMAIL", status: "ACTIVE", token: otp },
    });
    if (!verification || new Date() > verification.expiresAt) {
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
