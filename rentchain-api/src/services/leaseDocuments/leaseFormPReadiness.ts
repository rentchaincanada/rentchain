import type {
  FormPFieldEntry,
  FormPFieldStatus,
  FormPLeaseReadiness,
  FormPSectionKey,
  FormPSectionReadiness,
  FormPStructuredFields,
  PrimaryLeaseDocumentInput,
} from "./leaseDocumentTypes";

type FieldSpec = {
  sectionKey: FormPSectionKey;
  fieldKey: string;
  label: string;
  value?: unknown;
  status?: FormPFieldStatus;
  required?: boolean;
  conditional?: boolean;
  note?: string | null;
};

const SECTION_LABELS: Record<FormPSectionKey, string> = {
  parties: "Parties",
  premises: "Premises",
  term: "Term",
  rent_payments: "Rent & Payments",
  security_deposit: "Security Deposit",
  service_notices: "Service & Notices",
  rules_addenda: "Rules & Addenda",
  attachments_condition_report: "Attachments / Condition Report",
  signatures_delivery: "Signatures / Delivery",
};

const SECTION_ORDER = Object.keys(SECTION_LABELS) as FormPSectionKey[];

function cleanString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    const cleaned = cleanString(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item, 240)).filter(Boolean);
}

function consentValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "consented" : "";
  const cleaned = cleanString(value, 80).toLowerCase();
  if (["yes", "true", "consent", "consented", "provided"].includes(cleaned)) return "consented";
  if (["no", "false", "declined", "not_consented"].includes(cleaned)) return "";
  return cleaned;
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasValue(item));
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return cleanString(value).length > 0;
}

function overrideFor(overrides: Record<string, any> | null | undefined, sectionKey: FormPSectionKey, fieldKey: string) {
  const section = overrides?.[sectionKey];
  if (!section || typeof section !== "object") return null;
  const value = section[fieldKey];
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  return { value };
}

function fieldFromSpec(spec: FieldSpec, overrides?: Record<string, any> | null): FormPFieldEntry {
  const override = overrideFor(overrides, spec.sectionKey, spec.fieldKey);
  const overrideStatus = cleanString(override?.status, 40) as FormPFieldStatus;
  const allowed = new Set<FormPFieldStatus>(["provided", "not_applicable", "pending", "missing"]);
  if (allowed.has(overrideStatus)) {
    return {
      key: spec.fieldKey,
      label: spec.label,
      status: overrideStatus,
      value: overrideStatus === "not_applicable" ? null : override?.value ?? spec.value ?? null,
      note: cleanString(override?.note || spec.note || "") || null,
    };
  }

  const value = override?.value ?? spec.value;
  const status: FormPFieldStatus = spec.status || (hasValue(value) ? "provided" : spec.conditional ? "pending" : "missing");
  return {
    key: spec.fieldKey,
    label: spec.label,
    status,
    value: hasValue(value) ? (Array.isArray(value) ? asList(value) : (value as any)) : null,
    note: cleanString(override?.note || spec.note || "") || null,
  };
}

function normalizeDeliveryStatus(value: unknown): "" | "not_started" | "pending" | "delivered" | "acknowledged" | "not_applicable" {
  const cleaned = cleanString(value, 80).toLowerCase();
  if (!cleaned) return "";
  if (["not_started", "not started", "none", "missing"].includes(cleaned)) return "not_started";
  if (["pending", "in_progress", "in progress", "queued", "sent"].includes(cleaned)) return "pending";
  if (["delivered", "provided", "complete", "completed"].includes(cleaned)) return "delivered";
  if (["acknowledged", "confirmed", "viewed", "received"].includes(cleaned)) return "acknowledged";
  if (["not_applicable", "not applicable", "n/a", "na"].includes(cleaned)) return "not_applicable";
  return "";
}

function deliveryStatusForField(status: string, allowNotApplicable = true): FormPFieldStatus {
  if (status === "delivered" || status === "acknowledged") return "provided";
  if (status === "pending") return "pending";
  if (allowNotApplicable && status === "not_applicable") return "not_applicable";
  return "missing";
}

function booleanProvided(value: unknown): "yes" | "" {
  if (value === true) return "yes";
  const cleaned = cleanString(value, 40).toLowerCase();
  return ["yes", "true", "provided", "included", "delivered"].includes(cleaned) ? "yes" : "";
}

function sectionStatus(fields: FormPFieldEntry[]): FormPSectionReadiness["status"] {
  if (fields.length && fields.every((field) => field.status === "not_applicable")) return "not_applicable";
  if (fields.some((field) => field.status === "missing")) return "incomplete";
  if (fields.some((field) => field.status === "pending")) return "pending";
  return "complete";
}

function completionPercent(fields: FormPFieldEntry[]): number {
  if (!fields.length) return 100;
  const complete = fields.filter((field) => field.status === "provided" || field.status === "not_applicable").length;
  return Math.round((complete / fields.length) * 100);
}

export function deriveNovaScotiaFormPReadiness(input: PrimaryLeaseDocumentInput): {
  formPFields: FormPStructuredFields;
  leaseReadiness: FormPLeaseReadiness;
} {
  const lease = input.lease || {};
  const landlord = input.landlord || {};
  const property = input.property || {};
  const unit = input.unit || {};
  const tenants = input.tenants || [];
  const firstTenant = tenants[0] || {};
  const overrides = input.formPFields || null;
  const tenantNames = tenants
    .map((tenant) => firstNonEmpty(tenant.fullName, tenant.name, tenant.displayName, tenant.email))
    .filter(Boolean);
  const tenantEmails = tenants.map((tenant) => firstNonEmpty(tenant.email, tenant.serviceEmail)).filter(Boolean);
  const tenantPhones = tenants.map((tenant) => firstNonEmpty(tenant.phone, tenant.phoneNumber)).filter(Boolean);
  const landlordServiceEmail = firstNonEmpty(lease.landlordServiceEmail, landlord.serviceEmail, landlord.email);
  const tenantServiceEmail = firstNonEmpty(
    lease.tenantServiceEmail,
    lease.serviceEmail,
    firstTenant.serviceEmail,
    tenantEmails[0]
  );
  const landlordEmailConsent = consentValue(
    lease.landlordEmailServiceConsent ??
      lease.landlordEmailServiceConsentStatus ??
      lease.emailServiceConsent?.landlordConsentStatus ??
      lease.emailServiceConsent?.landlordConsented ??
      landlord.emailServiceConsent ??
      landlord.emailServiceConsentStatus ??
      landlord.emailServiceConsent?.consentStatus ??
      landlord.emailServiceConsent?.consented
  );
  const tenantEmailConsent = consentValue(
    lease.tenantEmailServiceConsent ??
      lease.tenantEmailServiceConsentStatus ??
      lease.emailServiceConsent?.tenantConsentStatus ??
      lease.emailServiceConsent?.tenantConsented ??
      firstTenant.emailServiceConsent ??
      firstTenant.emailServiceConsentStatus ??
      firstTenant.emailServiceConsent?.consentStatus ??
      firstTenant.emailServiceConsent?.consented
  );
  const emailConsentCapturedAt = firstNonEmpty(
    lease.emailServiceConsentCapturedAt,
    lease.emailServiceConsent?.capturedAt,
    firstTenant.emailServiceConsentCapturedAt,
    firstTenant.emailServiceConsent?.capturedAt,
    landlord.emailServiceConsentCapturedAt,
    landlord.emailServiceConsent?.capturedAt
  );
  const actCopyStatus = normalizeDeliveryStatus(
    lease.actCopyDeliveryStatus ||
      lease.actCopyDelivery?.status ||
      lease.residentialTenanciesActDeliveryStatus ||
      lease.residentialTenanciesActDelivery?.status
  );
  const actCopyMethod = firstNonEmpty(
    lease.actCopyDeliveryMethod,
    lease.actCopyDelivery?.method,
    lease.residentialTenanciesActDeliveryMethod,
    lease.residentialTenanciesActDelivery?.method
  );
  const actCopyDeliveredAt = firstNonEmpty(
    lease.actCopyDeliveredAt,
    lease.actCopyDelivery?.deliveredAt,
    lease.residentialTenanciesActDeliveredAt,
    lease.residentialTenanciesActDelivery?.deliveredAt
  );
  const actLinkIncluded = booleanProvided(
    lease.actLinkIncluded ?? lease.actCopyDelivery?.actLinkIncluded ?? lease.residentialTenanciesActDelivery?.actLinkIncluded
  );
  const actCopyProvided = booleanProvided(
    lease.actCopyProvided ?? lease.actCopyDelivery?.actCopyProvided ?? lease.residentialTenanciesActDelivery?.actCopyProvided
  );
  const actCopyOrLinkProvided = actLinkIncluded || actCopyProvided ? "yes" : "";
  const signedLeaseCopyStatus = normalizeDeliveryStatus(
    lease.signedLeaseCopyDeliveryStatus || lease.signedLeaseCopyDelivery?.status || lease.signedLeaseDelivery?.status
  );
  const signedLeaseCopyMethod = firstNonEmpty(
    lease.signedLeaseCopyDeliveryMethod,
    lease.signedLeaseCopyDelivery?.method,
    lease.signedLeaseDelivery?.method
  );
  const signedLeaseCopyDeliveredAt = firstNonEmpty(
    lease.signedLeaseCopyDeliveredAt,
    lease.signedLeaseCopyDelivery?.deliveredAt,
    lease.signedLeaseDelivery?.deliveredAt
  );
  const signedLeaseCopyAcknowledgedAt = firstNonEmpty(
    lease.signedLeaseCopyAcknowledgedAt,
    lease.signedLeaseCopyDelivery?.acknowledgedAt,
    lease.signedLeaseDelivery?.acknowledgedAt
  );
  const unitNumber = firstNonEmpty(unit.unitNumber, unit.label, lease.unitNumber);
  const fullAddress = [
    firstNonEmpty(property.addressLine1, property.address, property.name),
    firstNonEmpty(property.addressLine2, unitNumber ? `Unit ${unitNumber}` : ""),
    firstNonEmpty(property.city),
    firstNonEmpty(property.province || lease.province),
    firstNonEmpty(property.postalCode),
  ]
    .filter(Boolean)
    .join(", ");

  const specs: FieldSpec[] = [
    { sectionKey: "parties", fieldKey: "landlord_legal_name", label: "Landlord legal/display name", value: firstNonEmpty(landlord.legalName, landlord.displayName, landlord.name, landlord.email, lease.landlordName), required: true },
    { sectionKey: "parties", fieldKey: "landlord_service_email", label: "Landlord contact/service email", value: firstNonEmpty(landlord.serviceEmail, landlord.email), conditional: true },
    { sectionKey: "parties", fieldKey: "landlord_phone", label: "Landlord phone", value: firstNonEmpty(landlord.phone, landlord.phoneNumber), conditional: true },
    { sectionKey: "parties", fieldKey: "tenant_names", label: "Tenant names", value: tenantNames, required: true },
    { sectionKey: "parties", fieldKey: "tenant_emails", label: "Tenant email addresses", value: tenantEmails, conditional: true },
    { sectionKey: "parties", fieldKey: "tenant_phones", label: "Tenant phone numbers", value: tenantPhones, conditional: true },
    { sectionKey: "parties", fieldKey: "occupants", label: "Occupants/adult occupants/children", value: asList(lease.occupants || unit.occupants), conditional: true },

    { sectionKey: "premises", fieldKey: "full_civic_address", label: "Full civic address", value: fullAddress, required: true },
    { sectionKey: "premises", fieldKey: "unit_number", label: "Unit number", value: unitNumber, required: true },
    { sectionKey: "premises", fieldKey: "property_type", label: "Property type", value: firstNonEmpty(property.propertyType, property.type, lease.propertyType), conditional: true },
    { sectionKey: "premises", fieldKey: "mailing_or_po_box", label: "Mailing/PO box", value: firstNonEmpty(property.mailingAddress, property.poBox), conditional: true },
    { sectionKey: "premises", fieldKey: "emergency_contact", label: "Emergency contact", value: firstNonEmpty(lease.emergencyContact, property.emergencyContact), conditional: true },
    { sectionKey: "premises", fieldKey: "agent", label: "Agent", value: firstNonEmpty(property.agentName, lease.agentName), conditional: true },
    { sectionKey: "premises", fieldKey: "property_manager", label: "Property manager", value: firstNonEmpty(property.managerName, property.propertyManagerName, lease.propertyManagerName), conditional: true },
    { sectionKey: "premises", fieldKey: "building_superintendent", label: "Building superintendent", value: firstNonEmpty(property.superintendentName, lease.superintendentName), conditional: true },

    { sectionKey: "term", fieldKey: "start_date", label: "Start date", value: firstNonEmpty(lease.startDate), required: true },
    { sectionKey: "term", fieldKey: "end_date", label: "End date", value: firstNonEmpty(lease.endDate), conditional: true },
    { sectionKey: "term", fieldKey: "term_type", label: "Term type", value: firstNonEmpty(lease.termType), required: true },
    { sectionKey: "term", fieldKey: "periodic_details", label: "Fixed-term / periodic details", value: firstNonEmpty(lease.periodicDetails), conditional: true },
    { sectionKey: "term", fieldKey: "public_housing", label: "Public housing", value: firstNonEmpty(lease.publicHousing), conditional: true },

    { sectionKey: "rent_payments", fieldKey: "rent_amount", label: "Rent amount", value: lease.baseRentCents ?? lease.monthlyRent, required: true },
    { sectionKey: "rent_payments", fieldKey: "rent_frequency", label: "Rent frequency", value: firstNonEmpty(lease.rentFrequency, "monthly"), required: true },
    { sectionKey: "rent_payments", fieldKey: "due_day", label: "Due day", value: lease.dueDay, required: true },
    { sectionKey: "rent_payments", fieldKey: "payment_method", label: "Payment method", value: firstNonEmpty(lease.paymentMethod), required: true },
    { sectionKey: "rent_payments", fieldKey: "payee_destination", label: "Payee / payment destination", value: firstNonEmpty(lease.paymentDestination, lease.payeeName), conditional: true },
    { sectionKey: "rent_payments", fieldKey: "parking", label: "Parking", value: lease.parkingCents, conditional: true },
    { sectionKey: "rent_payments", fieldKey: "utilities_services_included", label: "Utilities/services included", value: asList(lease.utilitiesIncluded), conditional: true },
    { sectionKey: "rent_payments", fieldKey: "appliances_services_included", label: "Appliances/services included", value: asList(lease.appliancesIncluded || lease.servicesIncluded), conditional: true },
    { sectionKey: "rent_payments", fieldKey: "rental_incentives", label: "Rental incentives", value: firstNonEmpty(lease.rentalIncentives), conditional: true },
    { sectionKey: "rent_payments", fieldKey: "rent_increase_reference", label: "Rent increase reference fields", value: firstNonEmpty(lease.rentIncreaseReference), conditional: true },

    { sectionKey: "security_deposit", fieldKey: "deposit_amount", label: "Deposit amount", value: lease.depositCents, conditional: true },
    { sectionKey: "security_deposit", fieldKey: "deposit_paid_date", label: "Deposit paid date", value: firstNonEmpty(lease.depositPaidDate), conditional: true },
    { sectionKey: "security_deposit", fieldKey: "deposit_status", label: "Deposit status", value: firstNonEmpty(lease.depositStatus), conditional: true },
    { sectionKey: "security_deposit", fieldKey: "deposit_accounting_placeholder", label: "Deposit accounting / Form R placeholder", value: firstNonEmpty(lease.depositAccountingStatus), conditional: true },

    { sectionKey: "service_notices", fieldKey: "landlord_email_service_consent", label: "Landlord email service consent", value: landlordEmailConsent, required: true },
    { sectionKey: "service_notices", fieldKey: "tenant_email_service_consent", label: "Tenant email service consent", value: tenantEmailConsent, required: true },
    { sectionKey: "service_notices", fieldKey: "landlord_service_email", label: "Landlord service email", value: landlordServiceEmail, required: true },
    { sectionKey: "service_notices", fieldKey: "tenant_service_email", label: "Tenant service email", value: tenantServiceEmail, required: true },
    { sectionKey: "service_notices", fieldKey: "email_service_consent_captured_at", label: "Email service consent captured timestamp", value: emailConsentCapturedAt, conditional: true },
    { sectionKey: "service_notices", fieldKey: "notice_method_acknowledgement", label: "Notice/service method acknowledgement", value: firstNonEmpty(lease.noticeMethodAcknowledgement), conditional: true },

    { sectionKey: "rules_addenda", fieldKey: "additional_clauses", label: "Additional clauses", value: firstNonEmpty(lease.additionalClauses), conditional: true },
    { sectionKey: "rules_addenda", fieldKey: "rules_addenda_references", label: "Rules/addenda attachment references", value: asList(lease.rulesAddendaReferences), conditional: true },
    { sectionKey: "rules_addenda", fieldKey: "rules_acknowledgement", label: "Reasonableness/equal-application acknowledgement", value: firstNonEmpty(lease.rulesAcknowledgement), conditional: true },

    { sectionKey: "attachments_condition_report", fieldKey: "condition_report_reference", label: "Condition report reference", value: firstNonEmpty(lease.conditionReportReference), conditional: true },
    { sectionKey: "attachments_condition_report", fieldKey: "schedule_a_reference", label: "Schedule A reference", value: firstNonEmpty(lease.scheduleAUrl, lease.scheduleAReference, "Schedule A attached/sectioned separately"), required: true },
    { sectionKey: "attachments_condition_report", fieldKey: "addenda_list", label: "Addenda list", value: asList(lease.addendaList), conditional: true },

    {
      sectionKey: "signatures_delivery",
      fieldKey: "signed_lease_copy_delivery_status",
      label: "Signed lease copy delivery status",
      value: signedLeaseCopyStatus,
      status: deliveryStatusForField(signedLeaseCopyStatus, false),
    },
    {
      sectionKey: "signatures_delivery",
      fieldKey: "signed_lease_copy_delivery_method",
      label: "Signed lease copy delivery method",
      value: signedLeaseCopyMethod,
      status: signedLeaseCopyStatus === "pending" ? "pending" : undefined,
      conditional: true,
    },
    {
      sectionKey: "signatures_delivery",
      fieldKey: "signed_lease_copy_delivered_at",
      label: "Signed lease copy delivery timestamp",
      value: signedLeaseCopyDeliveredAt || signedLeaseCopyAcknowledgedAt,
      status: signedLeaseCopyStatus === "pending" ? "pending" : undefined,
      conditional: true,
    },
    {
      sectionKey: "signatures_delivery",
      fieldKey: "signed_lease_copy_acknowledgement",
      label: "Signed lease tenant delivery confirmation",
      value: signedLeaseCopyAcknowledgedAt,
      conditional: true,
    },
    {
      sectionKey: "signatures_delivery",
      fieldKey: "act_copy_delivery_status",
      label: "Residential Tenancies Act copy/link delivery status",
      value: actCopyStatus,
      status: deliveryStatusForField(actCopyStatus),
    },
    {
      sectionKey: "signatures_delivery",
      fieldKey: "act_copy_delivery_method",
      label: "Residential Tenancies Act delivery method",
      value: actCopyMethod,
      status: actCopyStatus === "pending" ? "pending" : undefined,
      conditional: true,
    },
    {
      sectionKey: "signatures_delivery",
      fieldKey: "act_copy_delivered_at",
      label: "Residential Tenancies Act delivery timestamp",
      value: actCopyDeliveredAt,
      status: actCopyStatus === "pending" ? "pending" : undefined,
      conditional: true,
    },
    {
      sectionKey: "signatures_delivery",
      fieldKey: "act_copy_or_link_provided",
      label: "Residential Tenancies Act copy or link provided",
      value: actCopyOrLinkProvided,
      status: actCopyStatus === "not_applicable" ? "not_applicable" : undefined,
    },
    {
      sectionKey: "signatures_delivery",
      fieldKey: "act_link_included",
      label: "Residential Tenancies Act link included",
      value: actLinkIncluded,
      status: actCopyStatus === "not_applicable" ? "not_applicable" : undefined,
      conditional: true,
    },
    {
      sectionKey: "signatures_delivery",
      fieldKey: "act_copy_provided",
      label: "Residential Tenancies Act copy provided",
      value: actCopyProvided,
      status: actCopyStatus === "not_applicable" ? "not_applicable" : undefined,
      conditional: true,
    },
  ];

  const grouped = SECTION_ORDER.reduce((acc, key) => ({ ...acc, [key]: {} }), {} as FormPStructuredFields);
  for (const spec of specs) {
    grouped[spec.sectionKey][spec.fieldKey] = fieldFromSpec(spec, overrides);
  }

  const sectionStatuses = SECTION_ORDER.map((key) => {
    const fields = Object.values(grouped[key]);
    return {
      key,
      label: SECTION_LABELS[key],
      status: sectionStatus(fields),
      completionPercent: completionPercent(fields),
      fields,
    };
  });
  const missingFields = sectionStatuses.flatMap((section) =>
    section.fields
      .filter((field) => field.status === "missing")
      .map((field) => ({ sectionKey: section.key, fieldKey: field.key, label: field.label }))
  );
  const nonBlockingItems = sectionStatuses.flatMap((section) =>
    section.fields
      .filter((field) => field.status === "pending" || field.status === "not_applicable")
      .map((field) => ({ sectionKey: section.key, fieldKey: field.key, label: field.label, status: field.status as "pending" | "not_applicable" }))
  );
  const allFields = sectionStatuses.flatMap((section) => section.fields);
  const completion = completionPercent(allFields);
  return {
    formPFields: grouped,
    leaseReadiness: {
      version: "ns_form_p_readiness_v1",
      jurisdictionCode: "CA_NS",
      overallStatus: missingFields.length ? "incomplete" : nonBlockingItems.some((item) => item.status === "pending") ? "pending" : "complete",
      completionPercent: completion,
      missingFields,
      blockingItems: missingFields,
      nonBlockingItems,
      sectionStatuses,
    },
  };
}
