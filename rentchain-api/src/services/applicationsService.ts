import type { Application, ApplicationStatus } from "../types/applications";
import { recordAuditEvent } from "./auditEventService";

// In-memory stub store; replace with real persistence when ready.
export const APPLICATIONS: Application[] = [
  {
    id: "a1",
    fullName: "Michael Chen",
    firstName: "Michael",
    lastName: "Chen",
    middleName: null,
    email: "michael.chen@example.com",
    phone: "902-555-1101",
    applicantEmail: "michael.chen@example.com",
    applicantPhone: "902-555-1101",
    consentCreditCheck: true,
    phoneVerified: false,
    phoneVerificationStatus: "unverified",
    phoneVerifiedAt: null,
    emailVerified: false,
    referencesContacted: false,
    referencesContactedAt: null,
    referencesNotes: null,
    screeningStatus: "not_ready",
    propertyId: "p-main",
    propertyName: "Main St. Apartments",
    unit: "203",
    unitApplied: "203",
    leaseStartDate: "2025-01-15",
    dateOfBirth: "1993-04-17",
    sinProvided: false,
    sinLast4: null,
    status: "in_review",
    riskLevel: "Medium",
    score: 78,
    monthlyIncome: 5200,
    requestedRent: 1450,
    rentToIncomeRatio: 0.279,
    moveInDate: "2025-01-15",
    createdAt: "2024-12-05T18:22:00Z",
    submittedAt: "2024-12-05",
    inReviewAt: "2024-12-06",
    notes: "Great references, short credit file. Works full-time in tech support.",
    flags: ["Short credit history", "One late payment reported 18 months ago"],
    recentAddress: {
      streetNumber: "1204",
      streetName: "Maple Avenue",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 2Y9",
    },
  },
  {
    id: "a2",
    fullName: "Aisha Hassan",
    firstName: "Aisha",
    lastName: "Hassan",
    middleName: null,
    email: "aisha.hassan@example.com",
    phone: "902-555-2202",
    applicantEmail: "aisha.hassan@example.com",
    applicantPhone: "902-555-2202",
    consentCreditCheck: true,
    phoneVerified: false,
    phoneVerificationStatus: "unverified",
    phoneVerifiedAt: null,
    emailVerified: false,
    referencesContacted: false,
    referencesContactedAt: null,
    referencesNotes: null,
    screeningStatus: "not_ready",
    propertyId: "p-downtown",
    propertyName: "Downtown Lofts",
    unit: "305",
    unitApplied: "305",
    leaseStartDate: "2025-02-01",
    dateOfBirth: "1990-10-04",
    sinProvided: false,
    sinLast4: null,
    status: "new",
    riskLevel: "Low",
    score: 91,
    monthlyIncome: 8200,
    requestedRent: 1650,
    rentToIncomeRatio: 0.201,
    moveInDate: "2025-02-01",
    createdAt: "2024-12-06T13:05:00Z",
    submittedAt: "2024-12-06",
    notes: "Strong income, long employment history, excellent landlord reference.",
    flags: ["Verified employer", "High disposable income"],
    recentAddress: {
      streetNumber: "88",
      streetName: "Harbourfront Lane",
      city: "Halifax",
      province: "NS",
      postalCode: "B3K 3M2",
    },
  },
];

export function getApplications(): Application[] {
  return APPLICATIONS;
}

export function getApplicationById(id: string): Application | undefined {
  return APPLICATIONS.find((app) => app.id === id);
}

export function saveApplication(updated: Application): Application {
  const idx = APPLICATIONS.findIndex((a) => a.id === updated.id);
  if (idx === -1) {
    APPLICATIONS.push(updated);
    return updated;
  }
  APPLICATIONS[idx] = updated;
  return updated;
}

export function requestCosigner(applicationId: string): Application {
  const app = getApplicationById(applicationId);
  if (!app) {
    throw new Error("Application not found");
  }
  const updated: Application = {
    ...app,
    cosignerRequested: true,
  };
  return saveApplication(updated);
}

export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus
): Promise<Application> {
  const app = getApplicationById(applicationId);
  if (!app) {
    throw new Error(`Application ${applicationId} not found`);
  }

  const nowIso = new Date().toISOString().slice(0, 10);

  const updated: Application = { ...app, status };

  if (!updated.submittedAt) {
    updated.submittedAt = nowIso;
  }

  if (status === "in_review" && !updated.inReviewAt) {
    updated.inReviewAt = nowIso;
  } else if (status === "approved" && !updated.approvedAt) {
    updated.approvedAt = nowIso;
  } else if (status === "rejected" && !updated.rejectedAt) {
    updated.rejectedAt = nowIso;
  }

  const saved = saveApplication(updated);

  try {
    await recordAuditEvent({
      entityType: "application",
      entityId: applicationId,
      applicationId,
      tenantId: (saved as any).tenantId ?? null,
      propertyId: (saved as any).propertyId ?? null,
      paymentId: null,
      kind: "application.status_changed",
      summary: `Application status changed to ${saved.status}`,
      detail: `Status updated for ${saved.fullName} on ${saved.propertyName} · ${saved.unit}`,
      meta: {
        status: saved.status,
        submittedAt: saved.submittedAt,
        inReviewAt: saved.inReviewAt ?? null,
        approvedAt: saved.approvedAt ?? null,
        rejectedAt: saved.rejectedAt ?? null,
      },
    });
  } catch (err) {
    console.error(
      "[applicationsService] Failed to record audit event for status change",
      err
    );
  }

  return saved;
}
