import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { findUserById } from "../services/userService";
import { User } from "../types/user";

const DEMO_MODE = process.env.DEMO_MODE === "true";

/**
 * In production:
 *  - Requires a valid JWT in "token" cookie
 *  - 401 if missing/invalid
 *
 * In demo mode:
 *  - If token is present and valid -> use real user
 *  - If no token -> inject a demo user and allow request through
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.method === "OPTIONS") return next();

  if (process.env.NODE_ENV !== "production") {
    const url = req.originalUrl || "";
    if (url.startsWith("/api/dev/")) {
      return next();
    }
  }

  const token = (req as any).cookies?.token as string | undefined;

  // Demo mode: allow requests through with a demo user if no token
  if (DEMO_MODE && !token) {
    const demoUser: User = {
      id: "demo-user",
      email: "demo@rentchain.local",
      passwordHash: "",
      plan: "pro",
      createdAt: new Date().toISOString(),
      twoFactorEnabled: false,
      twoFactorMethods: [],
      totpSecret: null,
      backupCodes: [],
    };
    (req as any).user = demoUser;
    next();
    return;
  }

  // Production or token-present: enforce auth
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const userId = verifyToken(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const user = await findUserById(userId);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  (req as any).user = user;
  next();
}
