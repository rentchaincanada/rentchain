// @ts-nocheck
import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { attachAccount } from "../middleware/attachAccount";

const router = Router();

router.post(
  "/",
  requireAuth,
  requirePermission("billing.manage"),
  attachAccount,
  async (req: AuthenticatedRequest, res) => {
    try {
      const landlordId = (req.user as any)?.landlordId || (req.user as any)?.id;
      if (!landlordId) return res.status(401).json({ error: "Unauthorized" });

      const desiredPlan = String(req.body?.desiredPlan || "").toLowerCase();
      if (!["core", "pro", "elite"].includes(desiredPlan)) {
        return res
          .status(400)
          .json({ error: "desiredPlan must be one of: core, pro, elite" });
      }

      const email =
        (req.body?.email ? String(req.body.email) : null) ||
        (req.user?.email ? String(req.user.email) : null) ||
        null;

      const context = req.body?.context ? String(req.body.context) : "unknown";
      const createdAt = new Date().toISOString();

      const doc = {
        landlordId,
        accountId: req.account?.id ?? landlordId,
        currentPlan: req.account?.plan ?? "starter",
        desiredPlan,
        email,
        context,
        createdAt,
        userAgent: String(req.headers["user-agent"] || ""),
        ipHint: String(
          req.headers["x-forwarded-for"] || req.socket.remoteAddress || ""
        ),
      };

      await db.collection("upgradeIntents").add(doc);

      return res.status(201).json({ ok: true });
    } catch (err: any) {
      console.error("[POST /upgrade-intent] error", err);
      return res.status(500).json({ error: "Failed to record upgrade intent" });
    }
  }
);

export default router;
