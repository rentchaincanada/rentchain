import { Router } from "express";
import { createHash } from "crypto";
import { db } from "../config/firebase";

const router = Router();

async function findLinkByToken(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const snap = await db.collection("applicationLinks").where("tokenHash", "==", tokenHash).limit(1).get();
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
    const now = Date.now();
    const isExpired = link?.expiresAt && now > Number(link.expiresAt);
    if (!link || link.status !== "ACTIVE" || isExpired) {
      if (link?.id && isExpired && link.status === "ACTIVE") {
        try {
          await db.collection("applicationLinks").doc(link.id).set({ status: "EXPIRED" }, { merge: true });
        } catch {
          // ignore
        }
      }
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
      data: {
        propertyId: link.propertyId || null,
        unitId: link.unitId || null,
        expiresAt: link.expiresAt ?? null,
        landlordBrandName: null,
      },
      context: { propertyName, unitLabel },
    });
  } catch (err: any) {
    console.error("[public application-links] lookup failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to load application link" });
  }
});

router.post("/rental-applications", async (req: any, res) => {
  res.setHeader("x-route-source", "publicApplicationLinksRoutes");
  try {
    const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
    const token = String(body?.token || "").trim();
    if (!token) return res.status(400).json({ ok: false, error: "token_required" });

    const link = await findLinkByToken(token);
    const now = Date.now();
    const isExpired = link?.expiresAt && now > Number(link.expiresAt);
    if (!link || link.status !== "ACTIVE" || isExpired) {
      if (link?.id && isExpired && link.status === "ACTIVE") {
        try {
          await db.collection("applicationLinks").doc(link.id).set({ status: "EXPIRED" }, { merge: true });
        } catch {
          // ignore
        }
      }
      return res.status(404).json({ ok: false, error: "APPLICATION_LINK_NOT_FOUND" });
    }

    const applicant = body?.applicant || {};
    const firstName = String(applicant?.firstName || "").trim();
    const lastName = String(applicant?.lastName || "").trim();
    const email = String(applicant?.email || "").trim();
    const dob = String(applicant?.dob || "").trim();
    const residentialHistory = Array.isArray(body?.residentialHistory) ? body.residentialHistory : [];
    const currentAddress = String(residentialHistory?.[0]?.address || "").trim();
    const consent = body?.consent || {};
    const applicantProfile = body?.applicantProfile || null;
    const applicationConsent = body?.applicationConsent || null;
    const creditConsent = consent?.creditConsent === true;
    const referenceConsent = consent?.referenceConsent === true;
    const acceptedAt =
      typeof consent?.acceptedAt === "number" && Number.isFinite(consent.acceptedAt)
        ? consent.acceptedAt
        : null;

    if (!firstName || !lastName || !email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "INVALID_APPLICANT" });
    }
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || !currentAddress) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST",
        detail: "DOB and current address are required.",
      });
    }
    if (!creditConsent || !referenceConsent || !acceptedAt) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST",
        detail: "Credit and reference consent are required.",
      });
    }

    const missingProfile: string[] = [];
    if (!applicantProfile?.currentAddress?.line1) missingProfile.push("currentAddress.line1");
    if (!applicantProfile?.currentAddress?.city) missingProfile.push("currentAddress.city");
    if (!applicantProfile?.currentAddress?.provinceState) missingProfile.push("currentAddress.provinceState");
    if (!applicantProfile?.currentAddress?.postalCode) missingProfile.push("currentAddress.postalCode");
    if (
      applicantProfile?.timeAtCurrentAddressMonths == null ||
      !Number.isFinite(Number(applicantProfile?.timeAtCurrentAddressMonths))
    ) {
      missingProfile.push("timeAtCurrentAddressMonths");
    }
    if (
      applicantProfile?.currentRentAmountCents == null ||
      !Number.isFinite(Number(applicantProfile?.currentRentAmountCents))
    ) {
      missingProfile.push("currentRentAmountCents");
    }
    if (!applicantProfile?.employment?.employerName) missingProfile.push("employment.employerName");
    if (!applicantProfile?.employment?.jobTitle) missingProfile.push("employment.jobTitle");
    if (
      applicantProfile?.employment?.incomeAmountCents == null ||
      !Number.isFinite(Number(applicantProfile?.employment?.incomeAmountCents))
    ) {
      missingProfile.push("employment.incomeAmountCents");
    }
    if (!applicantProfile?.employment?.incomeFrequency) missingProfile.push("employment.incomeFrequency");
    if (
      applicantProfile?.employment?.monthsAtJob == null ||
      !Number.isFinite(Number(applicantProfile?.employment?.monthsAtJob))
    ) {
      missingProfile.push("employment.monthsAtJob");
    }
    if (!applicantProfile?.workReference?.name) missingProfile.push("workReference.name");
    if (!applicantProfile?.workReference?.phone) missingProfile.push("workReference.phone");
    const sig = applicantProfile?.signature;
    if (!sig) {
      missingProfile.push("signature");
    } else if (sig.type === "drawn") {
      if (!sig.drawnDataUrl) missingProfile.push("signature.drawnDataUrl");
    } else if (sig.type === "typed") {
      if (!sig.typedName) missingProfile.push("signature.typedName");
      if (!sig.typedAcknowledge) missingProfile.push("signature.typedAcknowledge");
    }
    if (!applicationConsent?.accepted || !applicationConsent?.acceptedAt) {
      missingProfile.push("applicationConsent");
    }
    if (missingProfile.length) {
      return res.status(400).json({
        ok: false,
        error: "validation_failed",
        detail: "Required profile fields are missing.",
        fields: missingProfile,
      });
    }

    const appRef = db.collection("rentalApplications").doc();
    const applicationId = appRef.id;
    const createdAt = now;
    const payload: any = {
      landlordId: link.landlordId || null,
      propertyId: link.propertyId || null,
      unitId: link.unitId || null,
      applicationLinkId: link.id,
      createdAt,
      submittedAt: createdAt,
      updatedAt: createdAt,
      status: "SUBMITTED",
      applicant: {
        firstName,
        middleInitial: applicant?.middleInitial ?? null,
        lastName,
        email,
        phoneHome: applicant?.phoneHome ?? null,
        phoneWork: applicant?.phoneWork ?? null,
        dob: dob,
        maritalStatus: applicant?.maritalStatus ?? null,
      },
      coApplicant: body?.coApplicant
        ? {
            firstName: body?.coApplicant?.firstName ?? null,
            middleInitial: body?.coApplicant?.middleInitial ?? null,
            lastName: body?.coApplicant?.lastName ?? null,
            email: body?.coApplicant?.email ?? null,
            phoneHome: body?.coApplicant?.phoneHome ?? null,
            phoneWork: body?.coApplicant?.phoneWork ?? null,
            dob: body?.coApplicant?.dob ?? null,
            maritalStatus: body?.coApplicant?.maritalStatus ?? null,
          }
        : null,
      otherResidents: Array.isArray(body?.otherResidents) ? body.otherResidents : [],
      residentialHistory,
      employment: body?.employment ?? { applicant: {}, coApplicant: null },
      references: body?.references ?? null,
      loans: Array.isArray(body?.loans) ? body.loans : [],
      vehicles: Array.isArray(body?.vehicles) ? body.vehicles : [],
      nextOfKin: body?.nextOfKin ?? null,
      coNextOfKin: body?.coNextOfKin ?? null,
      consent: {
        creditConsent: creditConsent,
        referenceConsent: referenceConsent,
        dataSharingConsent: consent?.dataSharingConsent === true,
        acceptedAt,
        applicantNameTyped: consent?.applicantNameTyped ?? null,
        coApplicantNameTyped: consent?.coApplicantNameTyped ?? null,
        ip: req.ip || null,
        userAgent: req.get("user-agent") || null,
      },
      applicantProfile: applicantProfile,
      applicationConsent: applicationConsent,
      formVersion: body?.formVersion || "v2",
      screening: {
        requested: false,
        requestedAt: null,
        status: "NOT_REQUESTED",
        provider: "STUB",
        orderId: null,
        result: null,
        amountCents: null,
        currency: "CAD",
        paidAt: null,
        scoreAddOn: false,
        scoreAddOnCents: null,
        totalAmountCents: null,
        serviceLevel: "SELF_SERVE",
        aiVerification: false,
        ai: null,
      },
      identityMatchBasis: "DOB_ADDRESS",
    };

    await appRef.set(payload, { merge: true });

    return res.json({ ok: true, data: { applicationId } });
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
