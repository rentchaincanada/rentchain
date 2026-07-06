import { Router } from "express";
import { db } from "../firebase";
import { authenticateJwt } from "../middleware/authMiddleware";
import { handleScreeningReport } from "./screeningReportHandler";

const router = Router();

function ensureAdmin(req: any, res: any) {
  const role = String(req.user?.role || "").toLowerCase();
  if (role !== "admin") {
    res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return false;
  }
  return true;
}

function resolveLandlordId(req: any) {
  return String(req.user?.landlordId || req.user?.id || req.user?.uid || "").trim();
}

function ensureLandlordWorkspace(req: any, res: any) {
  const role = String(req.user?.role || "").toLowerCase();
  const landlordId = resolveLandlordId(req);
  if (!["landlord", "admin"].includes(role) || !landlordId) {
    res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return null;
  }
  return landlordId;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNullableString(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function projectLandlordVerifiedScreeningItem(data: any, index: number) {
  return {
    id: `verified-screening-${index + 1}`,
    createdAt: asNumber(data?.createdAt),
    updatedAt: asNumber(data?.updatedAt),
    status: String(data?.status || "QUEUED").toUpperCase(),
    serviceLevel: String(data?.serviceLevel || "VERIFIED").toUpperCase(),
    applicant: {
      name: asNullableString(data?.applicant?.name) || "Applicant",
      email: asNullableString(data?.applicant?.email) || null,
    },
    aiIncluded: Boolean(data?.aiIncluded),
    scoreAddOn: Boolean(data?.scoreAddOn),
    totalAmountCents: asNumber(data?.totalAmountCents),
    currency: String(data?.currency || "CAD").toUpperCase(),
    completedAt: data?.completedAt == null ? null : asNumber(data.completedAt),
    resultSummary: asNullableString(data?.resultSummary),
    recommendation: asNullableString(data?.recommendation)?.toUpperCase() || null,
  };
}

router.use(authenticateJwt);

router.get("/screening/report", handleScreeningReport);

router.get("/landlord/verified-screenings", async (req: any, res) => {
  try {
    const landlordId = ensureLandlordWorkspace(req, res);
    if (!landlordId) return;

    const snap = await db
      .collection("verifiedScreeningQueue")
      .where("landlordId", "==", landlordId)
      .limit(200)
      .get();
    const items = snap.docs
      .map((doc) => doc.data() as any)
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .map((item, index) => projectLandlordVerifiedScreeningItem(item, index));
    return res.json({ ok: true, data: items });
  } catch (err: any) {
    console.error("[verified-screenings] landlord list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "VERIFIED_SCREENINGS_LIST_FAILED" });
  }
});

router.get("/admin/verified-screenings", async (req: any, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const snap = await db.collection("verifiedScreeningQueue").limit(200).get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
    items.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    return res.json({ ok: true, data: items });
  } catch (err: any) {
    console.error("[verified-screenings] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "VERIFIED_SCREENINGS_LIST_FAILED" });
  }
});

router.get("/admin/verified-screenings/:id", async (req: any, res) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const snap = await db.collection("verifiedScreeningQueue").doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    return res.json({ ok: true, data: { id: snap.id, ...(snap.data() as any) } });
  } catch (err: any) {
    console.error("[verified-screenings] read failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "VERIFIED_SCREENING_READ_FAILED" });
  }
});

router.patch("/admin/verified-screenings/:id", async (req: any, res) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const snap = await db.collection("verifiedScreeningQueue").doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const updates: any = { updatedAt: Date.now() };
    const nextStatus = req.body?.status ? String(req.body.status || "").toUpperCase() : null;
    if (nextStatus) {
      if (["QUEUED", "IN_PROGRESS", "COMPLETE", "CANCELLED"].includes(nextStatus)) {
        updates.status = nextStatus;
        if (nextStatus === "COMPLETE") {
          updates.completedAt = updates.updatedAt;
        }
      }
    }
    if (req.body?.notesInternal !== undefined) {
      updates.notesInternal = req.body.notesInternal === null ? null : String(req.body.notesInternal || "");
    }
    if (req.body?.resultSummary !== undefined) {
      updates.resultSummary = req.body.resultSummary === null ? null : String(req.body.resultSummary || "");
    }
    if (req.body?.recommendation !== undefined) {
      const rec = req.body.recommendation;
      updates.recommendation = rec === null ? null : String(rec || "").toUpperCase();
    }

    await db.collection("verifiedScreeningQueue").doc(id).set(updates, { merge: true });
    const refreshed = await db.collection("verifiedScreeningQueue").doc(id).get();
    return res.json({ ok: true, data: { id: refreshed.id, ...(refreshed.data() as any) } });
  } catch (err: any) {
    console.error("[verified-screenings] update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "VERIFIED_SCREENING_UPDATE_FAILED" });
  }
});

export default router;
