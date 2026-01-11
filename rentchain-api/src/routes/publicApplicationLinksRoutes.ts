import { Router } from "express";
import { db, FieldValue } from "../config/firebase";

const router = Router();

async function findLinkByToken(token: string) {
  const snap = await db.collection("application_links").where("token", "==", token).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as any) };
}

router.get("/application-links/:token", async (req: any, res) => {
  res.setHeader("x-route-source", "publicApplicationLinksRoutes");
  try {
    const token = String(req.params?.token || "").trim();
    if (!token) return res.status(400).json({ ok: false, error: "Missing token" });

    const link = await findLinkByToken(token);
    if (!link || link.isActive === false) {
      return res.status(404).json({ ok: false, error: "APPLICATION_LINK_NOT_FOUND" });
    }

    // Fetch context (best-effort)
    let propertyName: string | null = null;
    let unitLabel: string | null = null;

    if (link.propertyId) {
      try {
        const propSnap = await db.collection("properties").doc(String(link.propertyId)).get();
        if (propSnap.exists) {
          propertyName = (propSnap.data() as any)?.name || (propSnap.data() as any)?.addressLine1 || null;
        }
      } catch {
        /* ignore */
      }
    }

    if (link.unitId) {
      try {
        const unitSnap = await db.collection("units").doc(String(link.unitId)).get();
        if (unitSnap.exists) {
          unitLabel = (unitSnap.data() as any)?.unitNumber || null;
        }
      } catch {
        /* ignore */
      }
    }

    return res.json({
      ok: true,
      link: {
        token,
        propertyId: link.propertyId || null,
        unitId: link.unitId || null,
      },
      context: {
        landlordDisplayName: null,
        propertyName,
        unitLabel,
      },
    });
  } catch (err: any) {
    console.error("[public application-links] lookup failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to load application link" });
  }
});

router.post("/applications", async (req: any, res) => {
  res.setHeader("x-route-source", "publicApplicationLinksRoutes");
  try {
    const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
    const token = String(body?.token || "").trim();
    const applicant = body?.applicant || {};
    const fullName = String(applicant?.fullName || "").trim();
    const email = String(applicant?.email || "").trim();
    const phone = String(applicant?.phone || "").trim();
    const message = applicant?.message ? String(applicant.message) : "";

    if (!token) return res.status(400).json({ ok: false, error: "token_required" });
    if (!fullName || !email || !phone || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "invalid_applicant" });
    }

    const link = await findLinkByToken(token);
    if (!link || link.isActive === false) {
      return res.status(404).json({ ok: false, error: "APPLICATION_LINK_NOT_FOUND" });
    }

    const now = new Date();
    const appRef = db.collection("applications").doc();
    const applicationId = appRef.id;

    const payload: any = {
      landlordId: link.landlordId || null,
      propertyId: link.propertyId || null,
      unitId: link.unitId || null,
      applicantFullName: fullName,
      applicantEmail: email,
      applicantPhone: phone,
      applicantMessage: message || null,
      status: "new",
      source: "public_link",
      phoneVerified: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdAtServer: FieldValue.serverTimestamp ? FieldValue.serverTimestamp() : now,
      updatedAtServer: FieldValue.serverTimestamp ? FieldValue.serverTimestamp() : now,
    };

    await appRef.set(payload, { merge: true });

    return res.json({ ok: true, applicationId });
  } catch (err: any) {
    console.error("[public applications] create failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to submit application" });
  }
});

function safeParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default router;
