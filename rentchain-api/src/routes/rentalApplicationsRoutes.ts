import { Router } from "express";
import { db } from "../config/firebase";
import { authenticateJwt } from "../middleware/authMiddleware";

const router = Router();

const ALLOWED_STATUS = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "DECLINED",
  "CONDITIONAL_COSIGNER",
  "CONDITIONAL_DEPOSIT",
];

function applicantName(app: any): string {
  const first = String(app?.firstName || "").trim();
  const last = String(app?.lastName || "").trim();
  return `${first} ${last}`.trim() || "Applicant";
}

router.use(authenticateJwt);

router.get("/rental-applications", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const propertyId = String(req.query?.propertyId || "").trim();
    const status = String(req.query?.status || "").trim().toUpperCase();

    let query: FirebaseFirestore.Query = db
      .collection("rentalApplications")
      .where("landlordId", "==", landlordId);

    if (propertyId) {
      query = query.where("propertyId", "==", propertyId);
    }
    if (status) {
      query = query.where("status", "==", status);
    }

    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      snap = await query.limit(200).get();
    } catch (err) {
      snap = await db
        .collection("rentalApplications")
        .where("landlordId", "==", landlordId)
        .limit(200)
        .get();
    }

    const items = snap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        applicantName: applicantName(data?.applicant),
        email: data?.applicant?.email || null,
        propertyId: data?.propertyId || null,
        unitId: data?.unitId || null,
        status: data?.status || "SUBMITTED",
        submittedAt: data?.submittedAt || null,
      };
    });

    items.sort((a, b) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0));
    return res.json({ ok: true, data: items });
  } catch (err: any) {
    console.error("[rental-applications] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "RENTAL_APPLICATIONS_LIST_FAILED" });
  }
});

router.get("/rental-applications/:id", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const snap = await db.collection("rentalApplications").doc(id).get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    const data = snap.data() as any;
    if (data?.landlordId && data.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    return res.json({ ok: true, data: { id: snap.id, ...(data as any) } });
  } catch (err: any) {
    console.error("[rental-applications] read failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "RENTAL_APPLICATION_READ_FAILED" });
  }
});

router.patch("/rental-applications/:id", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const snap = await db.collection("rentalApplications").doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const data = snap.data() as any;
    if (data?.landlordId && data.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const updates: any = { updatedAt: Date.now() };
    if (req.body?.status) {
      const nextStatus = String(req.body.status || "").toUpperCase();
      if (ALLOWED_STATUS.includes(nextStatus)) {
        updates.status = nextStatus;
      }
    }
    if (req.body?.note !== undefined) {
      const note = req.body.note;
      updates.landlordNote = note === null ? null : String(note || "").trim().slice(0, 5000);
    }

    await db.collection("rentalApplications").doc(id).set(updates, { merge: true });
    const refreshed = await db.collection("rentalApplications").doc(id).get();
    return res.json({ ok: true, data: { id: refreshed.id, ...(refreshed.data() as any) } });
  } catch (err: any) {
    console.error("[rental-applications] update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "RENTAL_APPLICATION_UPDATE_FAILED" });
  }
});

export default router;
