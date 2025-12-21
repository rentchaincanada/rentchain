import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authMiddleware";
import { getOrCreateAccount } from "../services/accountService";

export async function attachAccount(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ error: "Unauthorized" });
    req.account = await getOrCreateAccount(landlordId);
    return next();
  } catch (err: any) {
    console.error("[attachAccount] error", err);
    return res.status(500).json({ error: "Failed to load account" });
  }
}
