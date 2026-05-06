import type {
  DeriveInstitutionExportPackageInput,
  InstitutionExportAudience,
  InstitutionExportPackage,
  InstitutionExportPackageType,
  InstitutionExportRedaction,
  InstitutionExportSection,
  InstitutionExportSectionKey,
  InstitutionExportSectionStatus,
} from "./institutionExportTypes";

const PACKAGE_AUDIENCE: Record<InstitutionExportPackageType, InstitutionExportAudience> = {
  lender_due_diligence: "lender",
  insurance_review: "insurer",
  government_program_review: "government",
  auditor_review: "auditor",
  internal_admin_review: "internal",
};

const DEFAULT_REDACTIONS: InstitutionExportRedaction[] = [
  {
    fieldCategory: "tenant_contact_details",
    reason: "Tenant email, phone, and private contact details are excluded from V1 previews.",
  },
  {
    fieldCategory: "identity_documents",
    reason: "Identity documents and document images are excluded from institution export previews.",
  },
  {
    fieldCategory: "screening_payloads",
    reason: "Raw bureau, credit, and screening provider payloads are excluded.",
  },
  {
    fieldCategory: "payment_account_details",
    reason: "Bank account, card, processor payload, and provider account details are excluded.",
  },
  {
    fieldCategory: "private_message_contents",
    reason: "Unrestricted tenant, landlord, and support message bodies are excluded.",
  },
];

function asString(value: unknown, max = 240): string {
  const next = String(value ?? "").trim().slice(0, max);
  return next || "";
}

function asCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.floor(count);
}

function arrayOf<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function cleanId(value: unknown): string {
  return asString(value, 240)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeGeneratedAt(value: unknown): string {
  const raw = asString(value, 120);
  const date = raw ? new Date(raw) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function section(
  sectionKey: InstitutionExportSectionKey,
  label: string,
  status: InstitutionExportSectionStatus,
  recordsCount: number,
  blockedReasons: string[] = []
): InstitutionExportSection {
  return {
    sectionKey,
    label,
    status,
    recordsCount: Math.max(0, Math.floor(recordsCount)),
    blockedReasons,
  };
}

function statusOf(value: unknown): string {
  return asString(value, 80).toLowerCase();
}

function countActiveProperties(properties: Array<Record<string, unknown>>) {
  return properties.filter((property) => {
    const status = statusOf(property.status);
    return !status || ["active", "available", "occupied", "listed"].includes(status);
  }).length;
}

function countActiveLeases(leases: Array<Record<string, unknown>>) {
  return leases.filter((lease) => {
    const status = statusOf(lease.status || lease.lifecycleState || lease.derivedLifecycleState);
    return ["active", "occupied", "signed", "current"].includes(status);
  }).length;
}

function countOccupiedUnits(input: {
  units: Array<Record<string, unknown>>;
  leases: Array<Record<string, unknown>>;
}) {
  const occupiedFromUnits = input.units.filter((unit) => {
    const status = statusOf(unit.occupancyStatus || unit.status);
    return status === "occupied" || Boolean(asString(unit.leaseId, 240));
  }).length;
  if (input.units.length) return occupiedFromUnits;

  const occupiedUnitIds = new Set(
    input.leases
      .filter((lease) => countActiveLeases([lease]) > 0)
      .map((lease) => asString(lease.unitId, 240))
      .filter(Boolean)
  );
  return occupiedUnitIds.size;
}

function countTotalUnits(input: {
  units: Array<Record<string, unknown>>;
  properties: Array<Record<string, unknown>>;
  leases: Array<Record<string, unknown>>;
}) {
  if (input.units.length) return input.units.length;
  const declared = input.properties.reduce((sum, property) => {
    return sum + asCount(property.unitsCount ?? property.unitCount);
  }, 0);
  if (declared > 0) return declared;
  return new Set(input.leases.map((lease) => asString(lease.unitId, 240)).filter(Boolean)).size;
}

function summarizeDecisions(decisions: Array<Record<string, any>>) {
  const delinquency = decisions.filter((decision) => {
    return (
      statusOf(decision.workflow?.queue) === "delinquency_review" ||
      statusOf(decision.type) === "billing" ||
      statusOf(decision.id).includes("rent") ||
      statusOf(decision.id).includes("payment")
    );
  });
  return {
    total: decisions.length,
    critical: decisions.filter((decision) => statusOf(decision.severity) === "critical").length,
    high: decisions.filter((decision) => statusOf(decision.severity) === "high").length,
    delinquency: delinquency.length,
  };
}

function summarizeMaintenance(records: Array<Record<string, unknown>>) {
  return {
    total: records.length,
    open: records.filter((record) => {
      const status = statusOf(record.status || record.state);
      return !status || ["open", "new", "pending", "assigned", "in_progress"].includes(status);
    }).length,
    completed: records.filter((record) => {
      const status = statusOf(record.status || record.state);
      return ["completed", "closed", "resolved", "done"].includes(status);
    }).length,
  };
}

export function deriveInstitutionExportPackage(input: DeriveInstitutionExportPackageInput): InstitutionExportPackage {
  const packageType = input.packageType;
  const audience = PACKAGE_AUDIENCE[packageType];
  const landlordId = asString(input.landlordId, 240);
  const generatedAt = normalizeGeneratedAt(input.generatedAt);
  const properties = arrayOf(input.properties) as Array<Record<string, unknown>>;
  const leases = arrayOf(input.leases) as Array<Record<string, unknown>>;
  const units = arrayOf(input.units) as Array<Record<string, unknown>>;
  const maintenanceRequests = arrayOf(input.maintenanceRequests) as Array<Record<string, unknown>>;
  const decisionItems = arrayOf(input.decisionItems) as Array<Record<string, any>>;
  const auditEvents = arrayOf(input.auditEvents);

  const blockedReasons: string[] = [];
  if (!landlordId) blockedReasons.push("Landlord context is required before an institution export preview can be prepared.");
  if (!properties.length) blockedReasons.push("At least one landlord-scoped property is required for institution export preview.");

  const totalUnits = countTotalUnits({ units, properties, leases });
  const occupiedUnits = countOccupiedUnits({ units, leases });
  const activeProperties = countActiveProperties(properties);
  const activeLeases = countActiveLeases(leases);
  const decisionSummary = summarizeDecisions(decisionItems);
  const maintenanceSummary = summarizeMaintenance(maintenanceRequests);
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 1000) / 10 : null;

  const sections: InstitutionExportSection[] = [
    section(
      "property_summary",
      "Property summary",
      properties.length ? "included" : "blocked",
      properties.length,
      properties.length ? [] : ["No landlord-scoped property records were available."]
    ),
    section(
      "lease_summary",
      "Lease summary",
      leases.length ? "included" : "unavailable",
      leases.length,
      leases.length ? [] : ["No lease records were available for this landlord preview."]
    ),
    section(
      "occupancy_summary",
      "Occupancy summary",
      totalUnits > 0 || leases.length ? "included" : "unavailable",
      totalUnits || leases.length,
      totalUnits > 0 || leases.length ? [] : ["No unit or lease occupancy context was available."]
    ),
    section(
      "decision_summary",
      "Decision summary",
      decisionItems.length ? "included" : "unavailable",
      decisionItems.length,
      decisionItems.length ? [] : ["No landlord-safe decision inbox items were available."]
    ),
    section(
      "delinquency_summary",
      "Delinquency summary",
      decisionSummary.delinquency ? "included" : "unavailable",
      decisionSummary.delinquency,
      decisionSummary.delinquency ? [] : ["No landlord-safe delinquency decisions were available."]
    ),
    section(
      "maintenance_summary",
      "Maintenance summary",
      maintenanceRequests.length ? "included" : "unavailable",
      maintenanceRequests.length,
      maintenanceRequests.length ? [] : ["No maintenance records were available for this landlord preview."]
    ),
    section(
      "audit_event_summary",
      "Audit event summary",
      auditEvents.length ? "included" : "unavailable",
      auditEvents.length,
      auditEvents.length ? [] : ["No landlord-scoped audit events were available for this preview."]
    ),
  ];

  return {
    packageId: cleanId(`institution_export:${packageType}:${landlordId || "missing_landlord"}`),
    packageType,
    audience,
    status: blockedReasons.length ? "blocked" : "preview_ready",
    generatedAt,
    manualOnly: true,
    externalSubmissionEnabled: false,
    sections,
    blockedReasons,
    redactions: DEFAULT_REDACTIONS,
    payloadPreview: {
      packageType,
      audience,
      landlordContextAvailable: Boolean(landlordId),
      propertySummary: {
        propertyCount: properties.length,
        activePropertyCount: activeProperties,
        unitCount: totalUnits,
      },
      leaseSummary: {
        leaseCount: leases.length,
        activeLeaseCount: activeLeases,
      },
      occupancySummary: {
        occupiedUnits,
        totalUnits,
        occupancyRate,
      },
      decisionSummary,
      delinquencySummary: {
        decisionsCount: decisionSummary.delinquency,
        criticalCount: decisionItems.filter(
          (decision) =>
            statusOf(decision.severity) === "critical" &&
            (statusOf(decision.workflow?.queue) === "delinquency_review" || statusOf(decision.type) === "billing")
        ).length,
      },
      maintenanceSummary,
      auditEventSummary: {
        total: auditEvents.length,
      },
    },
  };
}
