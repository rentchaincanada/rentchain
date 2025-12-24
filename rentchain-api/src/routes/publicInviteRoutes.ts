import { Router } from "express";
import { db } from "../config/firebase";
import { incrementCounter } from "../services/telemetryService";

const router = Router();

function isEnabled() {
  const v = String(process.env.WAITLIST_INVITES_ENABLED ?? "false").toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function nowMs() {
  return Date.now();
}

function safeStatus(status: string) {
  const s = String(status || "").toLowerCase();
  if (!s) return "unknown";
  return s;
}

router.get("/invites/:inviteId", async (req, res) => {
  try {
    const inviteId = String(req.params.inviteId || "").trim();
    if (!inviteId || inviteId.length < 16 || inviteId.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid invite id" });
    }

    if (!isEnabled()) {
      return res.status(503).json({ ok: false, error: "Invites temporarily disabled" });
    }

    const invRef = db.collection("waitlist_invites").doc(inviteId);
    const invSnap = await invRef.get();
    if (!invSnap.exists) {
      return res.status(404).json({ ok: false, error: "Invite not found" });
    }

    const inv = invSnap.data() as any;
    const status = safeStatus(inv?.status);

    if (["failed", "revoked", "expired"].includes(status)) {
      return res.status(410).json({ ok: false, error: `Invite ${status}` });
    }

    const waitlistId = String(inv?.waitlistId || inv?.waitlistID || inv?.waitlist_id || "");
    if (!waitlistId) {
      return res.status(500).json({ ok: false, error: "Invite missing waitlistId" });
    }

    const wlRef = db.collection("waitlist").doc(waitlistId);
    const wlSnap = await wlRef.get();
    if (!wlSnap.exists) {
      return res.status(404).json({ ok: false, error: "Waitlist record not found" });
    }
    const wl = wlSnap.data() as any;
    const wlStatus = safeStatus(wl?.status);

    if (wlStatus === "unsubscribed") {
      return res.status(410).json({ ok: false, error: "Unsubscribed" });
    }

    return res.json({
      ok: true,
      inviteId,
      campaign: inv?.campaign || "micro-live",
      inviteStatus: status,
      waitlistId,
      waitlistStatus: wlStatus,
      email: wl?.email ? String(wl.email) : null,
      name: wl?.name ? String(wl.name) : null,
      sentAt: inv?.sentAt || null,
      acceptedAt: inv?.acceptedAt || null,
    });
  } catch (err: any) {
    console.error("[GET /api/public/invites/:inviteId] error", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

router.post("/invites/:inviteId/accept", async (req, res) => {
  try {
    const inviteId = String(req.params.inviteId || "").trim();
    if (!inviteId || inviteId.length < 16 || inviteId.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid invite id" });
    }

    if (!isEnabled()) {
      return res.status(503).json({ ok: false, error: "Invites temporarily disabled" });
    }

    const fullName = req.body?.fullName ? String(req.body.fullName).slice(0, 120) : null;
    const companyName = req.body?.companyName ? String(req.body.companyName).slice(0, 120) : null;
    const phone = req.body?.phone ? String(req.body.phone).slice(0, 40) : null;

    const invRef = db.collection("waitlist_invites").doc(inviteId);

  const result = await db.runTransaction(async (tx: any) => {
      const invSnap = await tx.get(invRef);
      if (!invSnap.exists) {
        return { ok: false, code: 404, error: "Invite not found" };
      }

      const inv = invSnap.data() as any;
      const invStatus = safeStatus(inv?.status);

      if (["failed", "revoked", "expired"].includes(invStatus)) {
        return { ok: false, code: 410, error: `Invite ${invStatus}` };
      }

      const waitlistId = String(inv?.waitlistId || "");
      if (!waitlistId) {
        return { ok: false, code: 500, error: "Invite missing waitlistId" };
      }

      const wlRef = db.collection("waitlist").doc(waitlistId);
      const wlSnap = await tx.get(wlRef);
      if (!wlSnap.exists) {
        return { ok: false, code: 404, error: "Waitlist record not found" };
      }

      const wl = wlSnap.data() as any;
      const wlStatus = safeStatus(wl?.status);
      if (wlStatus === "unsubscribed") {
        return { ok: false, code: 410, error: "Unsubscribed" };
      }

      const alreadyAccepted = Boolean(inv?.acceptedAt);
      const acceptedAt = inv?.acceptedAt || nowMs();
      const leadRef = db.collection("landlord_leads").doc(waitlistId);

      tx.set(
        leadRef,
        {
          waitlistId,
          inviteId,
          campaign: inv?.campaign || "micro-live",
          email: wl?.email || inv?.email || null,
          name: fullName || wl?.name || inv?.name || null,
          companyName: companyName || null,
          phone: phone || null,
          status: "invite-accepted",
          acceptedAt,
          updatedAt: nowMs(),
          createdAt: wl?.createdAt || nowMs(),
        },
        { merge: true }
      );

      tx.set(
        invRef,
        {
          status: "accepted",
          acceptedAt,
          updatedAt: nowMs(),
        },
        { merge: true }
      );

      tx.set(
        wlRef,
        {
          status: "onboarded",
          onboardedAt: wl?.onboardedAt || acceptedAt,
          updatedAt: nowMs(),
        },
        { merge: true }
      );

      return {
        ok: true,
        alreadyAccepted,
        waitlistId,
        inviteId,
        acceptedAt,
      };
    });

    if (!result.ok) {
      return res.status((result as any).code).json({ ok: false, error: (result as any).error });
    }

    await incrementCounter({ name: "waitlist_invite_accept", dims: { inviteId }, amount: 1 });

    return res.json({ ok: true, ...(result as any) });
  } catch (err: any) {
    console.error("[POST /api/public/invites/:inviteId/accept] error", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
