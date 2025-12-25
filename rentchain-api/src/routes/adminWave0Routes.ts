import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { db } from "../config/firebase";
import { incrementCounter, logEvent } from "../services/telemetryService";

const router = Router();

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function envTrue(key: string) {
  const v = String(process.env[key] ?? "false").toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

router.post("/micro-live/wave0/send", requireAuth, requireRole(["landlord", "admin"]), async (req: any, res) => {
  if (!envTrue("MICRO_LIVE_WAVE0_ENABLED")) {
    return res.status(403).json({ ok: false, error: "Wave 0 disabled" });
  }

  const campaign = String(process.env.MICRO_LIVE_WAVE0_CAMPAIGN ?? "wave0").slice(0, 80);
  const dryRun = Boolean(req.body?.dryRun ?? true);

  const emails = Array.isArray(req.body?.emails) ? req.body.emails : [];
  const list = emails.map(normEmail).filter((e: string) => e.includes("@"));
  if (!list.length) return res.status(400).json({ ok: false, error: "No valid emails" });
  if (list.length > 5) return res.status(400).json({ ok: false, error: "Wave 0 max is 5" });

  const results: any[] = [];

  for (const email of list) {
    const waitlistId = sha256(email);
    const wlRef = db.collection("waitlist").doc(waitlistId);

    await wlRef.set(
      {
        email,
        source: "wave0-admin",
        status: "confirmed",
        updatedAt: Date.now(),
        createdAt: Date.now(),
      },
      { merge: true }
    );

    const inviteId = sha256(`${campaign}:${waitlistId}`);
    const invRef = db.collection("waitlist_invites").doc(inviteId);
    const invSnap = await invRef.get();
    if (invSnap.exists) {
      results.push({ email, waitlistId, inviteId, skipped: true, reason: "already invited" });
      continue;
    }

    await invRef.set({
      waitlistId,
      email,
      campaign,
      status: dryRun ? "dry-run" : "queued",
      createdAt: Date.now(),
    });

    await incrementCounter({ name: "waitlist_invite_sent", dims: { campaign, wave: "wave0" }, amount: 1 });
    await logEvent({
      type: "waitlist_invite_sent",
      landlordId: null,
      actor: req.user?.email || req.user?.id || null,
      meta: { email, campaign, inviteId, wave: "wave0" },
    });

    results.push({ email, waitlistId, inviteId, queued: !dryRun, dryRun });
  }

  return res.json({ ok: true, campaign, dryRun, results });
});

export default router;
