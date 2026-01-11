// @ts-nocheck
// rentchain-api/src/routes/applicationsRoutes.ts
import { Router, Request, Response } from "express";
import { convertApplicationToTenant } from "../services/applicationConversionService";
import type { Application, ApplicationStatus } from "../types/applications";
import {
  APPLICATIONS,
  getApplications,
  getApplicationById,
  saveApplication,
  requestCosigner,
  updateApplicationStatus,
} from "../services/applicationsService";
import { recordAuditEvent } from "../services/auditEventService";
import { propertyService } from "../services/propertyService";
import {
  canSendCode,
  generateCode,
  saveCode,
  verifyCode,
} from "../services/phoneOtpService";
import { smsProvider } from "../services/smsProvider";
import { authenticateJwt } from "../middleware/authMiddleware";
import {
  recordApplicationEvent,
  getApplicationEvents,
} from "../services/applicationEventsService";
import { db } from "../config/firebase";

const router = Router();

type RiskLevel = Application["riskLevel"];
type ApplicantAddress = NonNullable<Application["primaryAddress"]>;
type CoApplicantSummary = NonNullable<Application["coApplicant"]>;
type HouseholdDetails = NonNullable<Application["household"]>;
type ReferenceDetails = NonNullable<Application["references"]>;

interface ApplicantRecentAddressPayload {
  streetNumber: string;
  streetName: string;
  city: string;
  province: string;
  postalCode: string;
}

interface NewApplicationPayload {
  propertyId: string;
  propertyName: string;
  unit: string;
  unitApplied?: string;
  leaseStartDate: string;
  requestedRent: number;

  primaryApplicant: {
    firstName: string;
    middleName?: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    dob?: string;
    recentAddress: ApplicantRecentAddressPayload;
    sinLast4?: string;
    sinProvided?: boolean;
  };

  employment?: {
    employer?: string;
    position?: string;
    monthlyIncome?: number;
  };

  coApplicant?: {
    fullName?: string;
    email?: string;
    phone?: string;
    monthlyIncome?: number;
    address?: string;
    city?: string;
    provinceState?: string;
    postalCode?: string;
  };

  references?: {
    currentLandlordName?: string;
    currentLandlordPhone?: string;
  };

  household?: {
    otherOccupants?: string;
    pets?: string;
    vehicles?: string;
    notes?: string;
  };

  creditConsent: boolean;
}

async function streamApplicationPdf(app: Application, res: Response) {
  let PDF: any;
  try {
    const mod: any = await import("pdfkit");
    PDF = mod?.default ?? mod;
  } catch (err: any) {
    console.error("[applications/pdf] pdfkit missing", err?.message || err);
    res.status(501).json({
      ok: false,
      code: "PDFKIT_MISSING",
      message: "PDF generation temporarily unavailable",
    });
    return;
  }

  const doc = new PDF({ margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="application-${app.id}.pdf"`
  );

  doc.pipe(res);

  // Header
  doc
    .fontSize(18)
    .text("Rental Application Summary", { align: "left" })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor("#555555")
    .text(`Application ID: ${app.id}`)
    .text(`Submitted: ${app.createdAt || "—"}`)
    .text(`Property: ${app.propertyName} – Unit ${app.unit}`, {
      lineGap: 2,
    })
    .moveDown(1);

  // Section: Underwriting snapshot
  doc
    .fontSize(12)
    .fillColor("black")
    .text("Underwriting snapshot", { underline: true })
    .moveDown(0.5);

  const rentToIncomePercent = app.rentToIncomeRatio
    ? Math.round(app.rentToIncomeRatio * 100)
    : 0;

  doc
    .fontSize(10)
    .text(`Status: ${app.status}`)
    .text(`Risk level: ${app.riskLevel}`)
    .text(`Score: ${app.score}/100`)
    .text(
      `Requested rent: ${
        app.requestedRent ? `$${app.requestedRent.toLocaleString()}` : "—"
      }`
    )
    .text(
      `Monthly income: ${
        app.monthlyIncome ? `$${app.monthlyIncome.toLocaleString()}` : "—"
      }`
    )
    .text(
      `Rent-to-income: ${
        rentToIncomePercent ? `${rentToIncomePercent}%` : "—"
      }`
    )
    .moveDown(1);

  // Section: Primary applicant
  doc.fontSize(12).text("Primary applicant", { underline: true }).moveDown(0.5);
  doc
    .fontSize(10)
    .text(`Name: ${app.fullName}`)
    .text(`Email: ${app.email}`)
    .text(`Phone: ${app.phone || "—"}`)
    .moveDown(0.3);

  if (
    app.primaryAddress?.address ||
    app.primaryAddress?.city ||
    app.primaryAddress?.provinceState ||
    app.primaryAddress?.postalCode
  ) {
    doc.text("Address:");
    if (app.primaryAddress.address) {
      doc.text(`  ${app.primaryAddress.address}`);
    }
    if (app.primaryAddress.city || app.primaryAddress.provinceState) {
      doc.text(
        `  ${app.primaryAddress.city || ""}${
          app.primaryAddress.city && app.primaryAddress.provinceState ? ", " : ""
        }${app.primaryAddress.provinceState || ""}`
      );
    }
    if (app.primaryAddress.postalCode) {
      doc.text(`  ${app.primaryAddress.postalCode}`);
    }
  } else {
    doc.text("Address: —");
  }

  doc.moveDown(1);

  // Section: Co-applicant
  doc.fontSize(12).text("Co-applicant", { underline: true }).moveDown(0.5);
  if (app.coApplicant) {
    doc
      .fontSize(10)
      .text(`Name: ${app.coApplicant.fullName || "—"}`)
      .text(`Email: ${app.coApplicant.email || "—"}`)
      .text(`Phone: ${app.coApplicant.phone || "—"}`)
      .text(
        `Monthly income: ${
          app.coApplicant.monthlyIncome
            ? `$${app.coApplicant.monthlyIncome.toLocaleString()}`
            : "—"
        }`
      );

    if (
      app.coApplicant.address ||
      app.coApplicant.city ||
      app.coApplicant.provinceState ||
      app.coApplicant.postalCode
    ) {
      doc.moveDown(0.3).text("Address:");
      if (app.coApplicant.address) {
        doc.text(`  ${app.coApplicant.address}`);
      }
      if (app.coApplicant.city || app.coApplicant.provinceState) {
        doc.text(
          `  ${app.coApplicant.city || ""}${
            app.coApplicant.city && app.coApplicant.provinceState ? ", " : ""
          }${app.coApplicant.provinceState || ""}`
        );
      }
      if (app.coApplicant.postalCode) {
        doc.text(`  ${app.coApplicant.postalCode}`);
      }
    }
  } else {
    doc.fontSize(10).text("No co-applicant on this file.");
  }

  doc.moveDown(1);

  // Section: Landlord reference
  doc
    .fontSize(12)
    .text("Current landlord reference", { underline: true })
    .moveDown(0.5);

  if (
    app.references?.currentLandlordName ||
    app.references?.currentLandlordPhone
  ) {
    doc
      .fontSize(10)
      .text(`Landlord / building: ${app.references.currentLandlordName || "—"}`)
      .text(`Phone: ${app.references.currentLandlordPhone || "—"}`);
  } else {
    doc.fontSize(10).text("No landlord reference details provided.");
  }

  doc.moveDown(1);

  // Section: Household
  doc.fontSize(12).text("Household & notes", { underline: true }).moveDown(0.5);

  if (
    app.household?.otherOccupants ||
    app.household?.pets ||
    app.household?.vehicles ||
    app.household?.notes
  ) {
    doc.fontSize(10);
    if (app.household.otherOccupants) {
      doc.text("Other occupants:").text(`  ${app.household.otherOccupants}`);
    }
    if (app.household.pets) {
      doc.moveDown(0.3).text("Pets:").text(`  ${app.household.pets}`);
    }
    if (app.household.vehicles) {
      doc.moveDown(0.3).text("Vehicles:").text(`  ${app.household.vehicles}`);
    }
    if (app.household.notes) {
      doc.moveDown(0.3).text("Applicant notes:").text(`  ${app.household.notes}`);
    }
  } else {
    doc.fontSize(10).text("No additional household details captured.");
  }

  if (app.flags && app.flags.length) {
    doc.moveDown(1);
    doc.fontSize(12).text("Underwriting flags", { underline: true }).moveDown(0.4);
    doc.fontSize(10);
    app.flags.forEach((flag) => {
      doc.text(`• ${flag}`);
    });
  }

  if (app.notes) {
    doc.moveDown(1);
    doc.fontSize(12).text("System notes", { underline: true }).moveDown(0.4);
    doc.fontSize(10).text(app.notes);
  }

  doc.end();
}

function trimValue(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveLeaseStartDate(app: Application): string {
  return trimValue(app.leaseStartDate) || trimValue(app.moveInDate);
}

function resolveUnitApplied(app: Application): string {
  return trimValue(app.unitApplied) || trimValue(app.unit);
}

function collectMissingScreeningFields(app: Application): string[] {
  const missing: string[] = [];
  const leaseStart = resolveLeaseStartDate(app);
  const unitApplied = resolveUnitApplied(app);

  if (!leaseStart) {
    missing.push("leaseStartDate");
  }
  if (!unitApplied) {
    missing.push("unitApplied");
  }
  if (!trimValue(app.firstName)) {
    missing.push("firstName");
  }
  if (!trimValue(app.lastName)) {
    missing.push("lastName");
  }
  if (!trimValue(app.dateOfBirth ?? undefined)) {
    missing.push("dateOfBirth");
  }

  const recentAddress = app.recentAddress || {};
  if (!trimValue(recentAddress.streetNumber)) {
    missing.push("streetNumber");
  }
  if (!trimValue(recentAddress.streetName)) {
    missing.push("streetName");
  }
  if (!trimValue(recentAddress.city)) {
    missing.push("city");
  }
  if (!trimValue(recentAddress.province)) {
    missing.push("province");
  }
  if (!trimValue(recentAddress.postalCode)) {
    missing.push("postalCode");
  }

  if (app.consentCreditCheck !== true) {
    missing.push("consentCreditCheck");
  }

  return missing;
}

/**
 * Public applicant endpoints (no auth)
 */
router.post("/submit", handleApplicationFormSubmit);
router.post("/:id/phone/send-code", handleSendPhoneCode);
router.post("/:id/phone/confirm", handleConfirmPhoneCode);
router.post("/:id/submit", handleSubmitApplication);

// Landlord/admin routes below require authentication
router.use(authenticateJwt);

/**
 * GET /api/applications
 */
router.get("/applications", async (req: any, res) => {
  try {
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const snap = await db.collection("applications").where("landlordId", "==", landlordId).limit(500).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];
    const toMillis = (v: any) => (v?.toMillis?.() ?? Date.parse(v || "") ?? 0);
    items.sort((a, b) => (toMillis(b.createdAt) || 0) - (toMillis(a.createdAt) || 0));

    // Fallback to in-memory if Firestore empty (legacy/demo)
    const result = items.length ? items : getApplications();
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[applications] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to load applications" });
  }
});

/**
 * GET /api/applications/:id/pdf
 */
router.get("/applications/:id/pdf", async (req, res) => {
  const { id } = req.params;
  const app = getApplicationById(id);

  if (!app) {
    return res.status(404).json({ error: "Application not found" });
  }

  try {
    await streamApplicationPdf(app, res);
  } catch (err: any) {
    console.error("[GET /api/applications/:id/pdf] error:", err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ error: "Failed to generate application PDF" });
    }
  }
});

/**
 * GET /api/applications/:id
 */
router.get("/applications/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const snap = await db.collection("applications").doc(id).get();
    if (snap.exists) {
      return res.status(200).json({ id: snap.id, ...(snap.data() as any) });
    }
  } catch (err) {
    console.error("[applications] get by id failed", err?.message || err);
  }

  const app = getApplicationById(id);
  if (!app) {
    return res.status(404).json({ error: "Application not found" });
  }

  return res.status(200).json(app);
});

router.get("/applications/:id/timeline", async (req: any, res: Response) => {
  const { id } = req.params;
  const landlordId = req.user?.landlordId || req.user?.id || null;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const events: any[] = [];
  const toMillis = (v: any): number | null => {
    if (!v) return null;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const t = Date.parse(v);
      return Number.isNaN(t) ? null : t;
    }
    if (typeof v?.toMillis === "function") return v.toMillis();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    return null;
  };

  const pushEvent = (type: string, title: string, tsLike: any) => {
    const ts = toMillis(tsLike);
    if (!ts) return;
    const createdAt = new Date(ts).toISOString();
    events.push({
      id: `${type}-${ts}-${id}`,
      type,
      title,
      ts,
      createdAt,
      message: title,
    });
  };

  try {
    const snap = await db.collection("applications").doc(id).get();
    if (snap.exists) {
      const data = { id: snap.id, ...(snap.data() as any) };
      if (data.landlordId && data.landlordId !== landlordId) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }

      pushEvent("submitted", "Application submitted", data.createdAt ?? data.submittedAt);
      pushEvent("in_review", "Moved to review", data.inReviewAt);

      if (data.status === "approved" || data.approvedAt) {
        pushEvent("approved", "Application approved", data.approvedAt ?? data.updatedAt);
      } else if (data.status === "rejected" || data.rejectedAt) {
        pushEvent("rejected", "Application rejected", data.rejectedAt ?? data.updatedAt);
      }

      if (data.convertedTenantId || data.tenantId || data.convertedAt) {
        pushEvent("converted", "Converted to tenant", data.convertedAt ?? data.updatedAt);
      }

      // Include any in-memory events if present (for legacy/local flows)
      const memEvents = getApplicationEvents(id);
      memEvents.forEach((e) => pushEvent(e.type, e.message || e.type, e.createdAt));

      events.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return res.status(200).json({ ok: true, events });
    }
  } catch (err) {
    console.error("[applications timeline] firestore fetch failed", err);
  }

  const app = getApplicationById(id);
  if (!app) {
    return res.status(404).json({ ok: false, error: "Application not found" });
  }

  pushEvent("submitted", "Application submitted", app.createdAt ?? app.submittedAt);
  if (app.status === "approved" || app.approvedAt) {
    pushEvent("approved", "Application approved", app.approvedAt ?? app.updatedAt);
  } else if (app.status === "rejected" || app.rejectedAt) {
    pushEvent("rejected", "Application rejected", app.rejectedAt ?? app.updatedAt);
  }
  if ((app as any).convertedTenantId || (app as any).tenantId || (app as any).convertedAt) {
    pushEvent("converted", "Converted to tenant", (app as any).convertedAt ?? app.updatedAt);
  }
  getApplicationEvents(id).forEach((e) =>
    pushEvent(e.type, e.message || e.type, e.createdAt)
  );

  events.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return res.status(200).json({ ok: true, events });
});

/**
 * PATCH /api/applications/:id
 * Update editable application details (names, dates, addresses, consent).
 */
router.patch("/applications/:id", (req, res) => {
  const { id } = req.params;
  const existing = getApplicationById(id);

  if (!existing) {
    return res.status(404).json({ error: "Application not found" });
  }

  const body = req.body as Partial<Application>;
  const updated: Application = {
    ...existing,
    leaseStartDate:
      body.leaseStartDate !== undefined
        ? trimValue(body.leaseStartDate) || null
        : existing.leaseStartDate,
    unitApplied:
      body.unitApplied !== undefined
        ? trimValue(body.unitApplied)
        : existing.unitApplied || existing.unit,
    dateOfBirth:
      body.dateOfBirth !== undefined
        ? trimValue(body.dateOfBirth) || ""
        : trimValue(existing.dateOfBirth) || "",
    consentCreditCheck:
      body.consentCreditCheck !== undefined
        ? !!body.consentCreditCheck
        : existing.consentCreditCheck === true,
    sinProvided:
      body.sinProvided !== undefined
        ? body.sinProvided
        : existing.sinProvided ?? false,
    sinLast4:
      body.sinLast4 !== undefined
        ? trimValue(body.sinLast4) || null
        : existing.sinLast4 ?? null,
  };

  if (body.firstName !== undefined) {
    updated.firstName = trimValue(body.firstName);
  }
  if (body.middleName !== undefined) {
    updated.middleName = trimValue(body.middleName) || null;
  }
  if (body.lastName !== undefined) {
    updated.lastName = trimValue(body.lastName);
  }
  if (body.email !== undefined) {
    const nextEmail = trimValue(body.email);
    updated.email = nextEmail;
    updated.applicantEmail = nextEmail;
  }

  if (body.recentAddress) {
    updated.recentAddress = {
      ...existing.recentAddress,
      ...body.recentAddress,
    };
    updated.recentAddress.streetNumber = trimValue(
      updated.recentAddress.streetNumber
    );
    updated.recentAddress.streetName = trimValue(
      updated.recentAddress.streetName
    );
    updated.recentAddress.city = trimValue(updated.recentAddress.city);
    updated.recentAddress.province = trimValue(updated.recentAddress.province);
    updated.recentAddress.postalCode = trimValue(
      updated.recentAddress.postalCode
    );
  }

  if (body.primaryAddress) {
    updated.primaryAddress = {
      ...existing.primaryAddress,
      ...body.primaryAddress,
    };
  }

  if (
    body.firstName !== undefined ||
    body.middleName !== undefined ||
    body.lastName !== undefined
  ) {
    const recomposed = [
      trimValue(updated.firstName),
      trimValue(updated.middleName ?? undefined),
      trimValue(updated.lastName),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    updated.fullName = recomposed || existing.fullName;
  }

  const saved = saveApplication(updated);
  return res.status(200).json(saved);
});

/**
 * PATCH /api/applications/:id/status
 */
router.patch("/applications/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status?: ApplicationStatus };

  if (!status || !["new", "in_review", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid or missing status value" });
  }

  try {
    updateApplicationStatus(id, status)
      .then((updated) => res.status(200).json(updated))
      .catch((err) => {
        console.error("[PATCH /applications/:id/status] service error", err);
        res.status(404).json({ error: err?.message || "Application not found" });
      });
  } catch (err: any) {
    console.error("[PATCH /applications/:id/status] error", err);
    return res.status(500).json({ error: "Failed to update status" });
  }
});

/**
 * POST /api/applications/:id/screening/payload
 * Validate required fields and build the credit report payload
 */
router.post("/applications/:id/screening/payload", (req, res) => {
  const { id } = req.params;
  const app = getApplicationById(id);

  if (!app) {
    return res.status(404).json({ error: "Application not found" });
  }

  const missing = collectMissingScreeningFields(app);
  if (missing.length) {
    return res.status(400).json({ error: "missing_fields", missing });
  }

  const property = propertyService.getById(app.propertyId);
  const leaseStartDate = resolveLeaseStartDate(app);
  const unitApplied = resolveUnitApplied(app);

  const payload = {
    building: {
      propertyId: app.propertyId,
      propertyName: property?.name || app.propertyName,
      propertyAddressLine1: property?.addressLine1 || "",
      city: property?.city || "",
      province: property?.province || "",
      postalCode: property?.postalCode || "",
      unitApplied,
      leaseStartDate,
    },
    applicant: {
      firstName: trimValue(app.firstName),
      middleName: trimValue(app.middleName ?? undefined) || undefined,
      lastName: trimValue(app.lastName),
      dateOfBirth: trimValue(app.dateOfBirth ?? undefined),
      sinProvided: !!(app.sinProvided || app.sinLast4 || app.sin),
      email: trimValue(app.email),
      phone: trimValue(app.phone),
    },
    address: {
      streetNumber: app.recentAddress?.streetNumber ?? "",
      streetName: app.recentAddress?.streetName ?? "",
      city: app.recentAddress?.city ?? "",
      province: app.recentAddress?.province ?? "",
      postalCode: app.recentAddress?.postalCode ?? "",
      country: "Canada",
    },
    consent: {
      creditCheck: true,
      consentedAt: app.submittedAt ?? app.createdAt ?? null,
    },
  };

  return res.status(200).json(payload);
});

/**
 * POST /api/applications/:id/request-cosigner
 */
router.post("/applications/:id/request-cosigner", (req, res) => {
  const { id } = req.params;

  try {
    const updated = requestCosigner(id);
    return res.status(200).json(updated);
  } catch (err: any) {
    console.error("[POST /applications/:id/request-cosigner] error", err);
    return res.status(404).json({ error: err?.message || "Application not found" });
  }
});

/**
 * POST /api/applications/:id/convert
 *
 * Real: convert an application into:
 *  - Tenant document
 *  - Lease document
 *  - Ledger/Event entry
 *
 * NOTE: This calls convertApplicationToTenant(id),
 *       which expects the source application data
 *       to be in Firestore (collection "applications").
 */
/**
 * POST /api/applications/:id/convert
 *
 * Real: convert an application into:
 *  - Tenant document
 *  - Lease document
 *  - Ledger/Event entry
 */
/**
 * POST /api/applications/:id/convert
 *
 * Real: convert an application into:
 *  - Tenant document
 *  - Lease document
 *  - Ledger/Event entry
 */
/**
 * POST /api/applications/:id/convert
 *
 * Real: convert an application into:
 *  - Tenant document
 *  - Lease document
 *  - Ledger/Event entry
 */
/**
 * POST /api/applications/:id/convert
 *
 * Real: convert an application into:
 *  - Tenant document
 *  - Lease document
 *  - Ledger/Event entry
 */
router.post(
  "/applications/:id/convert",
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const appIndex = APPLICATIONS.findIndex((a) => a.id === id);
    const app = getApplicationById(id);

    if (appIndex === -1 || !app) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    try {
      // Keep in-memory status visually in sync + timestamp
      const updatedApp = await updateApplicationStatus(id, "approved");

      // 2. Call the real backend service
      const result = await convertApplicationToTenant({
        id: app.id,
        fullName: app.fullName,
        email: app.email,
        phone: app.phone,
        propertyId: app.propertyId,
        unit: app.unit,
        requestedRent: app.requestedRent,
        moveInDate: app.moveInDate,
      });

      // 3. Sync identifiers back to the in-memory APPLICATIONS array
      (APPLICATIONS[appIndex] as any).tenantId = result.tenantId;
      (APPLICATIONS[appIndex] as any).leaseId = result.leaseId;
      (APPLICATIONS[appIndex] as any).ledgerEventId = result.ledgerEventId;
      (APPLICATIONS[appIndex] as any).convertedAt = result.convertedAt;
      (APPLICATIONS[appIndex] as any).status = "approved";

      try {
        await recordAuditEvent({
          entityType: "application",
          entityId: id,
          applicationId: id,
          tenantId: result.tenantId ?? null,
          propertyId: updatedApp.propertyId ?? null,
          paymentId: null,
          kind: "application.converted_to_tenant",
          summary: "Application converted to tenant",
          detail: `Application for ${updatedApp.fullName} was converted into tenant ${result.tenantId}.`,
          meta: {
            newTenantId: result.tenantId ?? null,
            propertyId: updatedApp.propertyId ?? null,
            unitLabel: (updatedApp as any).unit ?? null,
            leaseId: result.leaseId ?? null,
            ledgerEventId: result.ledgerEventId ?? null,
            convertedAt: result.convertedAt ?? null,
            status: updatedApp.status,
          },
        });
      } catch (auditErr) {
        console.error(
          "[applicationsRoutes] Failed to record audit event for conversion",
          auditErr
        );
      }

      // 4. Return the payload expected by the frontend
      return res.status(200).json({
        success: true,
        applicationId: id,
        tenantId: result.tenantId,
        leaseId: result.leaseId,
        ledgerEventId: result.ledgerEventId,
        convertedAt: result.convertedAt,
      });
    } catch (err: any) {
      console.error("[Convert Application] ERROR:", err);
      return res.status(500).json({
        success: false,
        message: err?.message || "Failed to convert application",
      });
    }
  }
);

/**
 * POST /api/applications/submit
 * MVP endpoint for the online Apply wizard.
 */
function handleApplicationFormSubmit(req: Request, res: Response) {
  try {
    const payload = req.body as NewApplicationPayload;

    const applicant = payload.primaryApplicant;
    const missing: string[] = [];

    if (!payload.propertyId) {
      missing.push("propertyId");
    }

    const unitApplied =
      (payload.unitApplied || payload.unit || "").toString().trim();
    if (!unitApplied) {
      missing.push("unitApplied");
    }

    if (!payload.leaseStartDate || !String(payload.leaseStartDate).trim()) {
      missing.push("leaseStartDate");
    }

    if (!applicant) {
      missing.push(
        "firstName",
        "lastName",
        "email",
        "phone",
        "dateOfBirth",
        "streetNumber",
        "streetName",
        "city",
        "province",
        "postalCode"
      );
    } else {
      if (!applicant.firstName || !applicant.firstName.trim()) {
        missing.push("firstName");
      }
      if (!applicant.lastName || !applicant.lastName.trim()) {
        missing.push("lastName");
      }
      if (!applicant.email || !applicant.email.trim()) {
        missing.push("email");
      }
      if (!applicant.phone || !applicant.phone.trim()) {
        missing.push("phone");
      }
      const dob = applicant.dateOfBirth || applicant.dob;
      if (!dob || !String(dob).trim()) {
        missing.push("dateOfBirth");
      }

      const address = applicant.recentAddress;
      if (!address?.streetNumber || !address.streetNumber.trim()) {
        missing.push("streetNumber");
      }
      if (!address?.streetName || !address.streetName.trim()) {
        missing.push("streetName");
      }
      if (!address?.city || !address.city.trim()) {
        missing.push("city");
      }
      if (!address?.province || !address.province.trim()) {
        missing.push("province");
      }
      if (!address?.postalCode || !address.postalCode.trim()) {
        missing.push("postalCode");
      }
    }

    if (!payload.creditConsent) {
      missing.push("consentCreditCheck");
    }

    if (missing.length) {
      return res.status(400).json({ error: "missing_fields", missing });
    }

    const rent =
      typeof payload.requestedRent === "number" && payload.requestedRent > 0
        ? payload.requestedRent
        : 0;

    const monthlyIncome =
      payload.employment?.monthlyIncome && payload.employment.monthlyIncome > 0
        ? payload.employment.monthlyIncome
        : 0;

    const rentToIncomeRatio =
      rent > 0 && monthlyIncome > 0 ? rent / monthlyIncome : 0;

    // Naive first-pass scoring – later: real AI underwriting
    let riskLevel: RiskLevel = "Low";
    let score = 85;
    const flags: string[] = [];

    if (rentToIncomeRatio >= 0.4 && rentToIncomeRatio < 0.5) {
      riskLevel = "Medium";
      score -= 10;
      flags.push("Rent-to-income above 40%");
    } else if (rentToIncomeRatio >= 0.5) {
      riskLevel = "High";
      score -= 25;
      flags.push("Rent-to-income above 50%");
    }

    if (!monthlyIncome) {
      riskLevel = "High";
      score -= 20;
      flags.push("No income information provided");
    }

    const extraNotes: string[] = ["Submitted via online application form."];
    if (payload.household?.otherOccupants) {
      extraNotes.push("Other occupants information provided.");
    }
    if (payload.household?.pets) {
      extraNotes.push("Pet information provided.");
    }
    if (payload.household?.vehicles) {
      extraNotes.push("Vehicle information provided.");
    }

    const applicantAddress =
      (applicant?.recentAddress as ApplicantRecentAddressPayload) ||
      ({} as ApplicantRecentAddressPayload);
    const applicantDob =
      (applicant?.dateOfBirth || applicant?.dob || "").trim();
    const addressLine = [
      applicantAddress.streetNumber,
      applicantAddress.streetName,
    ]
      .filter((part) => !!part && String(part).trim())
      .join(" ")
      .trim();

    const primaryAddress: ApplicantAddress = {
      address: addressLine || undefined,
      city: applicantAddress.city,
      provinceState: applicantAddress.province,
      postalCode: applicantAddress.postalCode,
    };

    const coApplicantSummary: CoApplicantSummary | undefined =
      payload.coApplicant
        ? {
            fullName: payload.coApplicant.fullName,
            email: payload.coApplicant.email,
            phone: payload.coApplicant.phone,
            monthlyIncome: payload.coApplicant.monthlyIncome,
            address: payload.coApplicant.address,
            city: payload.coApplicant.city,
            provinceState: payload.coApplicant.provinceState,
            postalCode: payload.coApplicant.postalCode,
          }
        : undefined;

    const householdDetails: HouseholdDetails | undefined = payload.household
      ? { ...payload.household }
      : undefined;

    const referenceDetails: ReferenceDetails | undefined = payload.references
      ? { ...payload.references }
      : undefined;

    const id = `app_${Date.now()}`;
    const createdAt = new Date().toISOString();

    const newApp: Application = {
      id,
      fullName: [applicant?.firstName, applicant?.middleName, applicant?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim(),
      firstName: applicant?.firstName?.trim() || "",
      middleName: applicant?.middleName?.trim() || null,
      lastName: applicant?.lastName?.trim() || "",
      email: applicant?.email?.trim() || "",
      applicantEmail: applicant?.email?.trim() || "",
      phone: applicant?.phone?.trim() || "",
      applicantPhone: applicant?.phone?.trim() || "",
      dateOfBirth: applicantDob || "",
      sinProvided: applicant?.sinProvided ?? !!applicant?.sinLast4,
      sinLast4: applicant?.sinLast4?.trim() || null,
      propertyId: payload.propertyId,
      propertyName: payload.propertyName,
      unit: payload.unit,
      unitApplied,
      leaseStartDate: payload.leaseStartDate,
      status: "new",
      riskLevel,
      score,
      monthlyIncome,
      requestedRent: rent,
      rentToIncomeRatio,
      moveInDate: payload.leaseStartDate || null,
      createdAt,
      consentCreditCheck: payload.creditConsent,
      phoneVerified: false,
      phoneVerificationStatus: "unverified",
      phoneVerifiedAt: null,
      referencesContacted: false,
      referencesContactedAt: null,
      referencesNotes: null,
      notes: extraNotes.join(" "),
      flags: flags.length ? flags : undefined,
      primaryAddress,
      recentAddress: {
        streetNumber: applicantAddress.streetNumber,
        streetName: applicantAddress.streetName,
        city: applicantAddress.city,
        province: applicantAddress.province,
        postalCode: applicantAddress.postalCode,
      },
      coApplicant: coApplicantSummary,
      household: householdDetails,
      references: referenceDetails,
    };

    APPLICATIONS.unshift(newApp);

    recordApplicationEvent({
      applicationId: newApp.id,
      type: "created",
      message: "Application created by tenant",
      actor: "tenant",
      metadata: { propertyId: newApp.propertyId },
    });

    return res.status(201).json(newApp);
  } catch (err: any) {
    console.error("[POST /api/applications/submit] error:", err);
    return res.status(500).json({
      error: err?.message ?? "Failed to submit application",
    });
  }
}

async function handleSendPhoneCode(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const application = getApplicationById(id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const phone = application.applicantPhone || application.phone;
    if (!phone) {
      return res.status(400).json({ error: "phone_missing" });
    }

    if (!canSendCode(phone)) {
      return res.status(429).json({
        error: "rate_limited",
        message: "Please wait before requesting another code.",
      });
    }

    const code = generateCode();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    saveCode(phone, code, expiresAt);

    await smsProvider.send(phone, "Your RentChain verification code is ready.");

    saveApplication({
      ...application,
      phoneVerified: false,
      phoneVerificationStatus: "pending",
    });

    recordApplicationEvent({
      applicationId: application.id,
      type: "phone_code_sent",
      message: "Verification code sent",
      actor: "system",
      metadata: { channel: "sms" },
    });

    return res.status(200).json({
      success: true,
      ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || "Failed to send code" });
  }
}

function handleConfirmPhoneCode(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { code } = req.body || {};

    const application = getApplicationById(id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const phone = application.applicantPhone || application.phone;
    if (!phone) {
      return res.status(400).json({ error: "phone_missing" });
    }

    if (!code || !verifyCode(phone, String(code))) {
      return res.status(400).json({
        error: "invalid_code",
        message: "Invalid or expired code.",
      });
    }

    const now = new Date().toISOString();
    const updated = saveApplication({
      ...application,
      phoneVerified: true,
      phoneVerificationStatus: "verified",
      phoneVerifiedAt: now,
    });

    recordApplicationEvent({
      applicationId: application.id,
      type: "phone_verified",
      message: "Phone verified",
      actor: "tenant",
      metadata: { method: "sms" },
    });

    return res.status(200).json(updated);
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || "Failed to verify code" });
  }
}

router.patch("/applications/:id/references", (req, res) => {
  try {
    const { id } = req.params;
    const { contacted, notes } = req.body || {};

    const application = getApplicationById(id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const contactedFlag = !!contacted;
    const now = new Date().toISOString();

    const updated = saveApplication({
      ...application,
      referencesContacted: contactedFlag,
      referencesContactedAt: contactedFlag ? now : null,
      referencesNotes: notes ?? null,
    });

    recordApplicationEvent({
      applicationId: application.id,
      type: "references_contacted",
      message: contactedFlag
        ? "References contacted"
        : "References marked not contacted",
      actor: "landlord",
    });

    return res.status(200).json(updated);
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || "Failed to update references" });
  }
});

function handleSubmitApplication(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const application = getApplicationById(id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (!application.phoneVerified) {
      return res.status(400).json({
        error: "phone_not_verified",
        message: "Phone verification required.",
      });
    }

    const now = new Date();
    const submittedAt = application.submittedAt || now.toISOString().slice(0, 10);
    const updated = saveApplication({
      ...application,
      status: application.status || "submitted",
      submittedAt,
      phoneVerificationStatus: "verified",
      phoneVerified: true,
      phoneVerifiedAt: application.phoneVerifiedAt || now.toISOString(),
    });

    recordApplicationEvent({
      applicationId: application.id,
      type: "submitted",
      message: "Application submitted",
      actor: "tenant",
    });

    return res.status(200).json(updated);
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || "Failed to submit application" });
  }
}

/**
 * Submit co-signer mini-application attached to an existing application
 */
router.post(
  "/applications/:applicationId/cosigner-submit",
  (req: Request, res: Response) => {
    try {
      const { applicationId } = req.params;

      const appIndex = APPLICATIONS.findIndex((a) => a.id === applicationId);
      if (appIndex === -1) {
        return res.status(404).json({ error: "Application not found" });
      }

      const payload = req.body as CosignerApplicationPayload;
      if (!payload.fullName || !payload.email || !payload.creditConsent) {
        return res.status(400).json({
          error:
            "fullName, email, and creditConsent are required for cosigner application",
        });
      }

      const submittedAt = new Date().toISOString();
      const cosignerApp: CosignerApplication = {
        ...payload,
        submittedAt,
      };

      APPLICATIONS[appIndex].cosignerApplication = cosignerApp;

      return res.status(200).json(APPLICATIONS[appIndex]);
    } catch (err: any) {
      console.error(
        "[POST /api/applications/:applicationId/cosigner-submit] error:",
        err
      );
      return res
        .status(500)
        .json({ error: err?.message ?? "Failed to submit co-signer" });
    }
  }
);

/**
 * Generate a lease draft from an application
 */
router.post(
  "/applications/:applicationId/generate-lease-draft",
  (req: Request, res: Response) => {
    try {
      const { applicationId } = req.params;
      const { startDate, endDate } = req.body as {
        startDate?: string;
        endDate?: string | null;
      };

      const app = APPLICATIONS.find((a) => a.id === applicationId);
      if (!app) {
        return res.status(404).json({ error: "Application not found" });
      }

      const now = new Date();
      const leaseStart = startDate || now.toISOString().slice(0, 10);
      const leaseEnd = endDate ?? null;

      const draft: LeaseDraft = {
        id: `draft_${Date.now()}`,
        applicationId,
        applicantName: app.fullName,
        propertyName: app.propertyName,
        unit: app.unit,
        monthlyRent: app.requestedRent,
        startDate: leaseStart,
        endDate: leaseEnd,
        createdAt: now.toISOString(),
        status: "DRAFT",
      };

      return res.status(200).json(draft);
    } catch (err: any) {
      console.error(
        "[POST /api/applications/:applicationId/generate-lease-draft] error:",
        err
      );
      return res
        .status(500)
        .json({ error: err?.message ?? "Failed to generate lease draft" });
    }
  }
);

export default router;
