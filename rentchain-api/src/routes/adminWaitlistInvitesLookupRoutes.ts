import { Router } from "express";
import { db } from "../config/firebase";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

// GET /api/admin/waitlist/invites?email=...&campaign=...
router.get("/waitlist/invites", requireAdmin, async (req: any, res) => {
  try {
    const email = String(req.query?.email || "").trim().toLowerCase();
    const campaign = req.query?.campaign ? String(req.query.campaign).trim() : "";

    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }

    let q: FirebaseFirestore.Query = db.collection("waitlist_invites").where("email", "==", email);
    if (campaign) q = q.where("campaign", "==", campaign);

    const snap = await q.orderBy("createdAt", "desc").limit(20).get();

    const invites = snap.docs.map((d: any) => {
      const v = d.data() || {};
      return {
        inviteId: d.id,
        email: v.email || null,
        campaign: v.campaign || null,
        status: v.status || null,
        createdAt: v.createdAt || null,
        sentAt: v.sentAt || null,
        acceptedAt: v.acceptedAt || null,
        waitlistId: v.waitlistId || null,
        inviteUrl: v.inviteUrl || null,
      };
    });

    return res.json({ ok: true, email, campaign: campaign || null, invites });
  } catch (e: any) {
    console.error("[GET /api/admin/waitlist/invites] error", e?.message || e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
