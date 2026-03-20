import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "command-center-secret-change-me";
const JWT_EXPIRES = "30d";

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const signToken = (payload: { id: number; email: string; code: string }): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
};

export const verifyToken = (token: string): { id: number; email: string; code: string } => {
  return jwt.verify(token, JWT_SECRET) as { id: number; email: string; code: string };
};
