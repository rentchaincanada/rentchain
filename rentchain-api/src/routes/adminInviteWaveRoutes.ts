import { Router } from "express";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { incrementCounter } from "../services/telemetryService";

const router = Router();

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function nowMs() {
  return Date.now();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildInviteEmail(params: {
  toEmail: string;
  toName?: string | null;
  inviteUrl: string;
  fromEmail: string;
}) {
  const { toEmail, toName, inviteUrl, fromEmail } = params;
  const greeting = toName ? `Hi ${toName},` : "Hi,";
  const subject = "Your RentChain Micro-Live invite is ready";
  const text =
    `${greeting}\n\n` +
    "You're invited to RentChain Micro-Live.\n\n" +
    `Start here:\n${inviteUrl}\n\n` +
    "If you didn't request this, you can ignore this email.\n\n" +
    "— RentChain\n";

  return { to: toEmail, from: fromEmail, subject, text };
}

router.post("/waitlist/invite-wave", requireAuth, requireRole(["landlord", "admin"]), async (req: any, res) => {
  const limitRaw = Number(req.body?.limit ?? 25);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 25;

  const statusIn =
    Array.isArray(req.body?.statusIn) && req.body.statusIn.length
      ? (req.body.statusIn as string[]).slice(0, 10)
      : ["pending", "confirmed"];

  const dryRun = Boolean(req.body?.dryRun ?? false);
  const sleepMs = Number(req.body?.sleepMs ?? 150);
  const campaign = String(req.body?.campaign ?? "micro-live").slice(0, 80);

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const appUrl = process.env.PUBLIC_APP_URL || "";

  if (!dryRun) {
    if (!apiKey || !fromEmail) {
      return res.status(500).json({ ok: false, error: "Missing SENDGRID_API_KEY or SENDGRID_FROM_EMAIL" });
    }
    sgMail.setApiKey(apiKey);
  }

  const candidates: any[] = [];
  const seenIds = new Set<string>();

  try {
    for (const st of statusIn) {
      if (candidates.length >= limit) break;
      let snap;
      try {
        snap = await db
          .collection("waitlist")
          .where("status", "==", st)
          .orderBy("createdAt", "asc")
          .limit(Math.max(limit - candidates.length, 1))
          .get();
      } catch (err) {
        // fallback if index/orderBy fails
        snap = await db
          .collection("waitlist")
          .where("status", "==", st)
          .limit(Math.max(limit - candidates.length, 1))
          .get();
      }

      for (const doc of snap.docs) {
        if (candidates.length >= limit) break;
        if (seenIds.has(doc.id)) continue;
        seenIds.add(doc.id);
        candidates.push({ id: doc.id, ...(doc.data() as any) });
      }
    }

    const results: any[] = [];
    const errors: any[] = [];
    const startedAt = nowMs();

    for (const w of candidates) {
      const email = String(w.email || "").trim().toLowerCase();
      const name = w.name ? String(w.name) : null;
      const status = String(w.status || "");

      if (["unsubscribed", "onboarded", "invited"].includes(status)) {
        results.push({ id: w.id, email, skipped: true, reason: `status=${status}` });
        continue;
      }
      if (!email || !email.includes("@")) {
        results.push({ id: w.id, skipped: true, reason: "missing/invalid email" });
        continue;
      }

      const inviteId = sha256(`${campaign}:${w.id}`);
      const inviteRef = db.collection("waitlist_invites").doc(inviteId);
      const waitlistRef = db.collection("waitlist").doc(w.id);
      let shouldSend = true;

      await db.runTransaction(async (tx) => {
        const inv = await tx.get(inviteRef);
        if (inv.exists) {
          shouldSend = false;
          return;
        }

        const wl = await tx.get(waitlistRef);
        if (!wl.exists) {
          shouldSend = false;
          return;
        }

        const wlData = wl.data() || {};
        const wlStatus = String(wlData.status || "");
        if (["unsubscribed", "onboarded"].includes(wlStatus)) {
          shouldSend = false;
          return;
        }

        tx.set(inviteRef, {
          waitlistId: w.id,
          email,
          name,
          campaign,
          createdAt: nowMs(),
          status: dryRun ? "dry-run" : "queued",
        });

        tx.set(
          waitlistRef,
          {
            status: "invited",
            invitedAt: nowMs(),
            invitedCampaign: campaign,
            updatedAt: nowMs(),
          },
          { merge: true }
        );
      });

      if (!shouldSend) {
        results.push({ id: w.id, email, skipped: true, reason: "already invited / not eligible" });
        continue;
      }

      const inviteUrl = appUrl
        ? `${appUrl.replace(/\/$/, "")}/micro-live?invite=${encodeURIComponent(inviteId)}`
        : `micro-live?invite=${inviteId}`;

      if (dryRun) {
        await inviteRef.set({ status: "dry-run-sent", sentAt: nowMs(), inviteUrl }, { merge: true });
        results.push({ id: w.id, email, dryRun: true, inviteId, inviteUrl, sent: true });
        continue;
      }

      try {
        const msg = buildInviteEmail({
          toEmail: email,
          toName: name,
          inviteUrl,
          fromEmail: fromEmail as string,
        });

        await sgMail.send({
          ...msg,
          trackingSettings: {
            clickTracking: { enable: false, enableText: false },
            openTracking: { enable: false },
          },
        });
        await inviteRef.set({ status: "sent", sentAt: nowMs(), inviteUrl }, { merge: true });
        await incrementCounter({ name: "waitlist_invite_sent", dims: { campaign }, amount: 1 });

        results.push({ id: w.id, email, inviteId, inviteUrl, sent: true });

        if (Number.isFinite(sleepMs) && sleepMs > 0) {
          await sleep(Math.min(Math.max(sleepMs, 0), 1500));
        }
      } catch (e: any) {
        console.error("[invite-wave] send error", email, e?.message || e);
        await inviteRef.set(
          { status: "failed", failedAt: nowMs(), error: String(e?.message || e) },
          { merge: true }
        );
        errors.push({ id: w.id, email, error: String(e?.message || e) });
        results.push({ id: w.id, email, sent: false, error: String(e?.message || e) });
      }
    }

    const finishedAt = nowMs();
    return res.json({
      ok: true,
      campaign,
      dryRun,
      requestedLimit: limit,
      candidates: candidates.length,
      sent: results.filter((r) => r.sent).length,
      skipped: results.filter((r) => r.skipped).length,
      failed: results.filter((r) => r.sent === false && !r.skipped).length,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      results,
      errors,
    });
  } catch (err: any) {
    console.error("[POST /api/admin/waitlist/invite-wave] error", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
