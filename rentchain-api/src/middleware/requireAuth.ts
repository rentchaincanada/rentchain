import type { Request, Response, NextFunction } from "express";
import { runExistingAuth } from "../auth/authAdapter";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = (req.headers.authorization ||
      (req.headers as any).Authorization) as string | undefined;

    if (!authHeader || typeof authHeader !== "string") {
      return res.status(401).json({ error: "Unauthorized: token required" });
    }

    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({ error: "Unauthorized: invalid token format" });
    }

    if ((req as any).user) return next();

    const result = await runExistingAuth(req, res);

    if (res.headersSent) return;

    if (result.ok && (req as any).user) return next();

    return res.status(401).json({ error: "Unauthorized" });
  } catch (_err) {
    if (res.headersSent) return;
    return res.status(401).json({ error: "Unauthorized" });
  }
}
