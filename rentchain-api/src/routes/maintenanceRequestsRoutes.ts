import { Router } from "express";
import { db } from "../config/firebase";
import { authenticateJwt } from "../middleware/authMiddleware";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "../services/emailService";

const router = Router();

const ALLOWED_STATUS = [
  "NEW",
  "IN_PROGRESS",
  "WAITING_ON_TENANT",
  "SCHEDULED",
  "RESOLVED",
  "CLOSED",
];

const NOTIFY_STATUS = [
  "IN_PROGRESS",
  "WAITING_ON_TENANT",
  "SCHEDULED",
  "RESOLVED",
  "CLOSED",
];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.use(authenticateJwt);

router.get("/maintenance-requests", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const { tenantId, status } = req.query || {};
    let query: FirebaseFirestore.Query = db
      .collection("maintenanceRequests")
      .where("landlordId", "==", landlordId)
      .limit(100);

    if (tenantId) {
      query = query.where("tenantId", "==", String(tenantId));
    }
    if (status && typeof status === "string") {
      query = query.where("status", "==", status.toUpperCase());
    }

    const snap = await query.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    items.sort((a, b) => (Number(b.updatedAt || 0) || 0) - (Number(a.updatedAt || 0) || 0));
    return res.json({ ok: true, data: items });
  } catch (err) {
    console.error("[maintenance-requests] list failed", { err });
    return res.status(500).json({ ok: false, error: "MAINT_REQUEST_LIST_FAILED" });
  }
});

router.patch("/maintenance-requests/:id", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const docRef = db.collection("maintenanceRequests").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    const data = snap.data() as any;
    if (data?.landlordId && data.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const updates: any = {};
    if (req.body?.status) {
      const st = String(req.body.status || "").toUpperCase();
      if (ALLOWED_STATUS.includes(st)) {
        updates.status = st;
      }
    }
    if (req.body?.landlordNote !== undefined) {
      const note = req.body.landlordNote;
      updates.landlordNote = note === null ? null : String(note || "").trim().slice(0, 5000);
    }
    updates.updatedAt = Date.now();
    updates.lastUpdatedBy = "LANDLORD";

    const previousStatus = String(data?.status || "NEW").toUpperCase();

    await docRef.update(updates);
    const refreshed = await docRef.get();
    const refreshedData = refreshed.data() as any;

    let emailed = false;
    let emailError: string | undefined;
    const nextStatus = String(refreshedData?.status || previousStatus).toUpperCase();
    const statusChanged = Boolean(updates.status) && nextStatus !== previousStatus;
    const shouldNotify = statusChanged && NOTIFY_STATUS.includes(nextStatus);

    if (shouldNotify) {
      const tenantId = refreshedData?.tenantId || data?.tenantId || null;
      if (!tenantId) {
        emailError = "MISSING_TENANT_ID";
      } else {
        let tenantEmail: string | null = null;
        try {
          const tenantSnap = await db.collection("tenants").doc(String(tenantId)).get();
          if (tenantSnap.exists) {
            const tenant = tenantSnap.data() as any;
            tenantEmail = typeof tenant?.email === "string" ? tenant.email.trim() : null;
          }
        } catch {
          // ignore lookup errors
        }

        if (!tenantEmail || !emailRegex.test(tenantEmail)) {
          emailError = "INVALID_TENANT_EMAIL";
        } else {
          const apiKey = process.env.SENDGRID_API_KEY;
          const from =
            process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
          const replyTo = process.env.SENDGRID_REPLY_TO || process.env.SENDGRID_REPLYTO_EMAIL;
          const baseUrl =
            (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(
              /\/$/,
              ""
            );
          const requestLink = `${baseUrl}/tenant/maintenance/${refreshed.id}`;
          const title = String(refreshedData?.title || "Maintenance request");
          const category = String(refreshedData?.category || "GENERAL");
          const priority = String(refreshedData?.priority || "NORMAL");
          const descriptionRaw = String(refreshedData?.description || "");
          const excerpt =
            descriptionRaw.length > 400 ? `${descriptionRaw.slice(0, 400)}...` : descriptionRaw;
          const timestamp = new Date().toISOString();

          if (!apiKey || !from) {
            emailError = "EMAIL_NOT_CONFIGURED";
          } else {
            try {
              await sendEmail({
                to: tenantEmail,
                from,
                replyTo: replyTo || from,
                subject: `Maintenance update: ${title} (${nextStatus})`,
                text: buildEmailText({
                  intro: `Your maintenance request was updated to ${nextStatus}.\nUpdated at: ${timestamp}\nCategory: ${category}\nPriority: ${priority}\n\n${excerpt}`,
                  ctaText: "View request",
                  ctaUrl: requestLink,
                }),
                html: buildEmailHtml({
                  title: "Maintenance request updated",
                  intro: `Status: ${nextStatus}. Updated at: ${timestamp}. Category: ${category}. Priority: ${priority}.`,
                  ctaText: "View request",
                  ctaUrl: requestLink,
                }),
              });
              emailed = true;
            } catch (err: any) {
              emailed = false;
              emailError = err?.message || "SEND_FAILED";
              console.error("[maintenance-requests] tenant email send failed", {
                requestId: refreshed.id,
                tenantId,
                tenantEmail,
                errMessage: err?.message,
                errBody: err?.response?.body,
              });
            }
          }
        }
      }
    }

    return res.json({
      ok: true,
      data: { id: refreshed.id, ...(refreshedData as any) },
      emailed,
      emailError,
    });
  } catch (err) {
    console.error("[maintenance-requests] update failed", { id: req.params?.id, err });
    return res.status(500).json({ ok: false, error: "MAINT_REQUEST_UPDATE_FAILED" });
  }
});

export default router;
