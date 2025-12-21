import crypto from "crypto";
import { getApplicationById, saveApplication } from "./applicationsService";
import { addConvertedTenant } from "./tenantDetailsService";
import { propertyService } from "./propertyService";
import { runScreeningWithCredits } from "./screeningsService";
import { logAuditEvent } from "./auditEventsService";

export async function convertApplicationToTenant(params: {
  landlordId: string;
  applicationId: string;
  runScreening: boolean;
  actorUserId?: string;
}): Promise<{
  tenantId: string;
  screening?: { screeningId: string; status: string };
  alreadyConverted: boolean;
}> {
  const application = getApplicationById(params.applicationId);
  if (!application) {
    throw new Error("Application not found");
  }
  if (application.landlordId && application.landlordId !== params.landlordId) {
    throw new Error("Forbidden");
  }

  if (application.convertedTenantId) {
    await logAuditEvent({
      landlordId: params.landlordId,
      actorUserId: params.actorUserId,
      type: "application_converted",
      applicationId: application.id,
      tenantId: application.convertedTenantId,
      payload: { alreadyConverted: true, runScreening: params.runScreening },
      occurredAt: new Date().toISOString(),
    });
    return {
      tenantId: application.convertedTenantId,
      alreadyConverted: true,
      screening: application.screeningRequestId
        ? { screeningId: application.screeningRequestId, status: "completed" }
        : undefined,
    };
  }

  const tenantId = crypto.randomUUID();
  addConvertedTenant({
    id: tenantId,
    fullName:
      application.applicantFullName ||
      application.fullName ||
      "Converted Applicant",
    email: application.applicantEmail ?? application.email ?? null,
    phone: application.applicantPhone ?? application.phone ?? null,
    propertyName: application.propertyName ?? null,
    propertyId: application.propertyId,
    unit: application.unitApplied ?? application.unit ?? null,
    leaseStart: application.leaseStartDate ?? application.moveInDate ?? null,
    leaseEnd: null,
    monthlyRent: application.requestedRent ?? null,
    status: "Active",
    balance: 0,
    riskLevel: "Low",
  });

  if (application.propertyId && application.unitApplied) {
    const property = propertyService.getById(application.propertyId);
    if (property?.units) {
      const unit = property.units.find(
        (u) => u.unitNumber === application.unitApplied
      );
      if (unit) {
        unit.status = "occupied";
      }
    }
  }

  const updated = {
    ...application,
    landlordId: params.landlordId,
    status: "converted",
    convertedTenantId: tenantId,
    updatedAt: new Date().toISOString(),
  };

  let screeningResult: { screeningId: string; status: string } | undefined;

  if (params.runScreening) {
    const screening = await runScreeningWithCredits({
      landlordId: params.landlordId,
      landlordEmail: application.applicantEmail ?? application.email,
      applicationId: application.id,
    });
    if (screening.screeningId) {
      updated.screeningRequestId = screening.screeningId;
      updated.screeningId = screening.screeningId;
      screeningResult = {
        screeningId: screening.screeningId,
        status: screening.status,
      };
      await logAuditEvent({
        landlordId: params.landlordId,
        actorUserId: params.actorUserId,
        type: "screening_triggered",
        applicationId: application.id,
        tenantId,
        screeningId: screening.screeningId,
        payload: { status: screening.status },
        occurredAt: new Date().toISOString(),
      });
    } else if (screening.status) {
      screeningResult = { screeningId: "", status: screening.status };
      if (screening.status === "blocked_no_credits") {
        await logAuditEvent({
          landlordId: params.landlordId,
          actorUserId: params.actorUserId,
          type: "screening_blocked_no_credits",
          applicationId: application.id,
          tenantId,
          payload: { status: screening.status },
          occurredAt: new Date().toISOString(),
        });
      }
    }
  }

  saveApplication(updated);

  await logAuditEvent({
    landlordId: params.landlordId,
    actorUserId: params.actorUserId,
    type: "application_converted",
    applicationId: application.id,
    tenantId,
    payload: { alreadyConverted: false, runScreening: params.runScreening },
    occurredAt: new Date().toISOString(),
  });

  return {
    tenantId,
    screening: screeningResult,
    alreadyConverted: false,
  };
}
