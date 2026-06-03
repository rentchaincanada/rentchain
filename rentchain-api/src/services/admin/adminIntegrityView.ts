import { db } from "../../firebase";
import {
  loadPropertyLeaseIntegrityDiagnostics,
  reportTenantPointerIssues,
  type LeaseIntegrityIssue,
} from "../leaseIntegrityService";

type FirestoreLike = Pick<FirebaseFirestore.Firestore, "collection">;
type IntegrityDoc = { id: string; raw: Record<string, unknown> };

export type AdminIntegritySample = {
  id: string;
  type: string;
  label: string;
  propertyId?: string | null;
  leaseId?: string | null;
  tenantId?: string | null;
  relatedAdminPath?: string | null;
};

export type AdminIntegritySection = {
  key:
    | "orphan_properties"
    | "missing_owner_linkage"
    | "duplicate_active_leases"
    | "stale_lease_pointers"
    | "property_unit_mismatches";
  label: string;
  severity: "high" | "medium" | "low";
  count: number;
  description: string;
  samples: AdminIntegritySample[];
};

export type AdminIntegrityView = {
  sections: AdminIntegritySection[];
  totals: {
    issueTypes: number;
    totalIssues: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
  };
};

const SAMPLE_LIMIT = 5;

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function boundedPush<T>(items: T[], next: T) {
  if (items.length < SAMPLE_LIMIT) items.push(next);
}

function makeSampleId(prefix: string, ids: Array<string | null | undefined>) {
  return [prefix, ...ids.map((value) => asTrimmedString(value)).filter(Boolean)].join(":");
}

function propertyLabel(property: IntegrityDoc) {
  return (
    asTrimmedString(property.raw.name) ||
    asTrimmedString(property.raw.address1) ||
    property.id
  );
}

function leaseIssueLabel(issue: LeaseIntegrityIssue, fallback: string) {
  const leaseIds = issue.relatedLeaseIds.filter(Boolean);
  const tenantIds = issue.relatedTenantIds.filter(Boolean);
  const parts = [fallback];
  if (leaseIds.length) parts.push(`Lease ${leaseIds[0]}`);
  if (tenantIds.length) parts.push(`Tenant ${tenantIds[0]}`);
  return parts.join(" · ");
}

export async function loadAdminIntegrity(options?: { firestore?: FirestoreLike }): Promise<AdminIntegrityView> {
  const firestore = (options?.firestore || (db as any)) as FirestoreLike;

  const propertiesSnap = await firestore.collection("properties").get();
  const propertyDocs: IntegrityDoc[] = (propertiesSnap.docs || []).map((doc: any) => ({
    id: doc.id,
    raw: (doc.data() || {}) as Record<string, unknown>,
  }));

  const sections: AdminIntegritySection[] = [
    {
      key: "orphan_properties",
      label: "Orphan Properties",
      severity: "high",
      count: 0,
      description: "Properties with no owner, landlord, or manager linkage and requiring manual review.",
      samples: [],
    },
    {
      key: "missing_owner_linkage",
      label: "Missing Owner Linkage",
      severity: "high",
      count: 0,
      description: "Properties missing owner linkage that may block trustworthy admin and landlord scoping.",
      samples: [],
    },
    {
      key: "duplicate_active_leases",
      label: "Duplicate Active Leases",
      severity: "high",
      count: 0,
      description: "Multiple active lease agreements appear to resolve to the same property/unit context.",
      samples: [],
    },
    {
      key: "stale_lease_pointers",
      label: "Stale Lease Pointers",
      severity: "medium",
      count: 0,
      description: "Tenant currentLeaseId pointers disagree with the current canonical lease for that tenant.",
      samples: [],
    },
    {
      key: "property_unit_mismatches",
      label: "Property / Unit Mismatches",
      severity: "medium",
      count: 0,
      description: "Unit occupancy or lease-derived property relationships disagree and need investigation.",
      samples: [],
    },
  ];

  const sectionsByKey = new Map(sections.map((section) => [section.key, section]));

  for (const property of propertyDocs) {
    const ownerUserId = asTrimmedString(property.raw.ownerUserId);
    const landlordId = asTrimmedString(property.raw.landlordId) || null;
    const managerUserIds = Array.isArray(property.raw.managerUserIds)
      ? property.raw.managerUserIds.map((value) => asTrimmedString(value)).filter(Boolean)
      : [];

    if (!ownerUserId) {
      const section = sectionsByKey.get("missing_owner_linkage")!;
      section.count += 1;
      boundedPush(section.samples, {
        id: makeSampleId("missing-owner", [property.id]),
        type: "property",
        label: propertyLabel(property),
        propertyId: property.id,
        relatedAdminPath: `/admin/properties?ownerUserId=&q=${encodeURIComponent(property.id)}`,
      });
    }

    if (!ownerUserId && !landlordId && managerUserIds.length === 0) {
      const section = sectionsByKey.get("orphan_properties")!;
      section.count += 1;
      boundedPush(section.samples, {
        id: makeSampleId("orphan-property", [property.id]),
        type: "property",
        label: propertyLabel(property),
        propertyId: property.id,
        relatedAdminPath: `/admin/properties?integrity=orphaned&q=${encodeURIComponent(property.id)}`,
      });
    }

    const [{ issues }, pointerIssues] = await Promise.all([
      loadPropertyLeaseIntegrityDiagnostics(property.id, landlordId, firestore as any).catch(() => ({ issues: [] as LeaseIntegrityIssue[] })),
      reportTenantPointerIssues(property.id, landlordId, firestore as any).catch(() => [] as LeaseIntegrityIssue[]),
    ]);

    for (const issue of issues) {
      if (issue.issueType === "duplicate_active_agreement_overlap") {
        const section = sectionsByKey.get("duplicate_active_leases")!;
        section.count += 1;
        boundedPush(section.samples, {
          id: makeSampleId("duplicate-active-lease", issue.relatedLeaseIds),
          type: "lease",
          label: leaseIssueLabel(issue, propertyLabel(property)),
          propertyId: property.id,
          leaseId: issue.relatedLeaseIds[0] || null,
          tenantId: issue.relatedTenantIds[0] || null,
          relatedAdminPath: issue.relatedLeaseIds[0]
            ? `/admin/leases?q=${encodeURIComponent(issue.relatedLeaseIds[0])}`
            : `/admin/leases?propertyId=${encodeURIComponent(property.id)}`,
        });
      }

      if (issue.issueType === "unit_status_mismatch") {
        const section = sectionsByKey.get("property_unit_mismatches")!;
        section.count += 1;
        boundedPush(section.samples, {
          id: makeSampleId("property-unit-mismatch", [property.id, issue.unitId || null, issue.relatedLeaseIds[0] || null]),
          type: "property_unit",
          label: leaseIssueLabel(issue, `${propertyLabel(property)} · Unit mismatch`),
          propertyId: property.id,
          leaseId: issue.relatedLeaseIds[0] || null,
          tenantId: issue.relatedTenantIds[0] || null,
          relatedAdminPath: issue.relatedLeaseIds[0]
            ? `/admin/leases?q=${encodeURIComponent(issue.relatedLeaseIds[0])}`
            : `/admin/properties?q=${encodeURIComponent(property.id)}`,
        });
      }
    }

    for (const issue of pointerIssues) {
      if (issue.issueType !== "tenant_stale_currentLeaseId") continue;
      const section = sectionsByKey.get("stale_lease_pointers")!;
      section.count += 1;
      const tenantId = issue.relatedTenantIds[0] || null;
      boundedPush(section.samples, {
        id: makeSampleId("stale-lease-pointer", [tenantId, issue.relatedLeaseIds[0] || null, issue.relatedLeaseIds[1] || null]),
        type: "tenant_pointer",
        label: leaseIssueLabel(issue, `${propertyLabel(property)} · Stale tenant pointer`),
        propertyId: property.id,
        leaseId: issue.relatedLeaseIds[0] || null,
        tenantId,
        relatedAdminPath: tenantId
          ? `/admin/tenants?q=${encodeURIComponent(tenantId)}`
          : `/admin/tenants?propertyId=${encodeURIComponent(property.id)}`,
      });
    }
  }

  const totals = sections.reduce(
    (acc, section) => {
      acc.totalIssues += section.count;
      if (section.count > 0) acc.issueTypes += 1;
      if (section.severity === "high") acc.highSeverity += section.count;
      if (section.severity === "medium") acc.mediumSeverity += section.count;
      if (section.severity === "low") acc.lowSeverity += section.count;
      return acc;
    },
    {
      issueTypes: 0,
      totalIssues: 0,
      highSeverity: 0,
      mediumSeverity: 0,
      lowSeverity: 0,
    }
  );

  return { sections, totals };
}
