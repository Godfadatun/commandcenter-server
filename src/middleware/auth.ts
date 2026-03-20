import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.service";

export interface AuthRequest extends Request {
  user?: { id: number; email: string; code: string };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }
  try {
    const token = header.split(" ")[1];
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
