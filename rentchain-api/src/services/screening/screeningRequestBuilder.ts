import { getApplicationById } from "../applicationsService";
import { getScreeningRequestById } from "../screeningRequestService";
import { propertyService } from "../propertyService";
import type { CreditProviderRequest } from "./providers/providerTypes";

interface BuildResultOk {
  ok: true;
  request: CreditProviderRequest;
}

interface BuildResultError {
  ok: false;
  missing: string[];
}

type BuildResult = BuildResultOk | BuildResultError;

function trimValue(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveLeaseStartDate(app: any): string {
  return trimValue(app.leaseStartDate) || trimValue(app.moveInDate);
}

function resolveUnitApplied(app: any): string {
  return trimValue(app.unitApplied) || trimValue(app.unit);
}

export function buildProviderRequest(
  screeningRequestId: string
): BuildResult {
  const screeningRequest = getScreeningRequestById(screeningRequestId);
  const application = screeningRequest?.applicationId
    ? getApplicationById(screeningRequest.applicationId)
    : undefined;

  if (!screeningRequest || !application) {
    return { ok: false, missing: ["application"] };
  }

  const property = propertyService.getById(application.propertyId);
  const missing: string[] = [];

  if (application.consentCreditCheck !== true) {
    missing.push("consentCreditCheck");
  }
  if (!application.phoneVerified) {
    missing.push("phoneVerified");
  }
  if (!application.referencesContacted) {
    missing.push("referencesContacted");
  }

  const leaseStartDate = resolveLeaseStartDate(application);
  const unitApplied = resolveUnitApplied(application);

  if (!leaseStartDate) {
    missing.push("leaseStartDate");
  }
  if (!unitApplied) {
    missing.push("unitApplied");
  }

  if (!trimValue(application.firstName)) {
    missing.push("firstName");
  }
  if (!trimValue(application.lastName)) {
    missing.push("lastName");
  }
  if (!trimValue(application.dateOfBirth)) {
    missing.push("dateOfBirth");
  }
  if (!trimValue(application.email)) {
    missing.push("email");
  }
  if (!trimValue(application.phone)) {
    missing.push("phone");
  }

  const recentAddress = application.recentAddress || {};
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

  if (!property) {
    missing.push("property");
  } else {
    if (!trimValue(property.addressLine1)) {
      missing.push("propertyAddress");
    }
    if (!trimValue(property.city)) {
      missing.push("propertyCity");
    }
    if (!trimValue(property.province)) {
      missing.push("propertyProvince");
    }
    if (!trimValue(property.postalCode)) {
      missing.push("propertyPostalCode");
    }
  }

  if (missing.length) {
    return { ok: false, missing };
  }

  const request: CreditProviderRequest = {
    applicationId: application.id,
    applicant: {
      firstName: trimValue(application.firstName),
      middleName: trimValue(application.middleName ?? null) || undefined,
      lastName: trimValue(application.lastName),
      dateOfBirth: trimValue(application.dateOfBirth),
    },
    contact: {
      email: trimValue(application.email),
      phone: trimValue(application.phone),
    },
    address: {
      streetNumber: trimValue(recentAddress.streetNumber),
      streetName: trimValue(recentAddress.streetName),
      city: trimValue(recentAddress.city),
      province: trimValue(recentAddress.province),
      postalCode: trimValue(recentAddress.postalCode),
      country: "Canada",
    },
    tenancy: {
      propertyName: property?.name,
      propertyAddressLine1: property?.addressLine1,
      city: property?.city,
      province: property?.province,
      postalCode: property?.postalCode,
      unitApplied,
      leaseStartDate,
    },
    consent: {
      creditCheck: true,
      consentedAt: application.submittedAt ?? application.createdAt ?? null,
    },
    sinLast4: application.sinLast4 ?? null,
  };

  return { ok: true, request };
}
