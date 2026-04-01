import type { AdminPropertyView, AdminPropertiesQuery } from "./adminPropertyView";
import { listAdminProperties } from "./adminPropertyView";
import type { AdminTenantView, AdminTenantsQuery } from "./adminTenantView";
import { listAdminTenants } from "./adminTenantView";
import type { AdminLeaseView, AdminLeasesQuery } from "./adminLeaseView";
import { listAdminLeases } from "./adminLeaseView";
import type { AdminIntegrityView } from "./adminIntegrityView";
import { loadAdminIntegrity } from "./adminIntegrityView";

export const ADMIN_EXPORT_ROW_CAP = 1000;

function csvValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => String(item ?? "")).filter(Boolean).join(" | ");
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function escapeCsv(value: unknown): string {
  const normalized = csvValue(value);
  if (!/[",\n\r]/.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ];
  return lines.join("\n");
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function exportQuery<T extends { page?: number | null; pageSize?: number | null }>(query?: T) {
  return {
    ...(query || {}),
    page: 1,
    pageSize: ADMIN_EXPORT_ROW_CAP,
  };
}

export async function buildAdminPropertiesCsv(query?: AdminPropertiesQuery) {
  const result = await listAdminProperties(exportQuery(query));
  const headers = [
    "id",
    "name",
    "address1",
    "city",
    "province",
    "postalCode",
    "ownerUserId",
    "landlordId",
    "managerUserIds",
    "unitCount",
    "occupiedUnitCount",
    "vacantUnitCount",
    "createdAt",
    "updatedAt",
    "integrity.hasIssues",
    "integrity.orphaned",
    "integrity.missingOwner",
  ];
  const rows = result.items.map((item: AdminPropertyView) => ({
    id: item.id,
    name: item.name,
    address1: item.address1,
    city: item.city,
    province: item.province,
    postalCode: item.postalCode,
    ownerUserId: item.ownerUserId,
    landlordId: item.landlordId,
    managerUserIds: item.managerUserIds,
    unitCount: item.unitCount,
    occupiedUnitCount: item.occupiedUnitCount,
    vacantUnitCount: item.vacantUnitCount,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    "integrity.hasIssues": item.integrity.hasIssues,
    "integrity.orphaned": item.integrity.orphaned,
    "integrity.missingOwner": item.integrity.missingOwner,
  }));
  return {
    filename: `admin-properties-${todayStamp()}.csv`,
    content: toCsv(headers, rows),
    rowCount: rows.length,
    capped: result.total > rows.length,
  };
}

export async function buildAdminTenantsCsv(query?: AdminTenantsQuery) {
  const result = await listAdminTenants(exportQuery(query));
  const headers = [
    "id",
    "fullName",
    "firstName",
    "lastName",
    "email",
    "phone",
    "landlordId",
    "propertyId",
    "propertyName",
    "unitId",
    "unitNumber",
    "leaseId",
    "leaseStatus",
    "screeningStatus",
    "moveInStatus",
    "currentLeaseStartDate",
    "currentLeaseEndDate",
    "createdAt",
    "updatedAt",
    "flags.missingLeaseLink",
    "flags.missingPropertyLink",
    "flags.hasScreening",
  ];
  const rows = result.items.map((item: AdminTenantView) => ({
    id: item.id,
    fullName: item.fullName,
    firstName: item.firstName,
    lastName: item.lastName,
    email: item.email,
    phone: item.phone,
    landlordId: item.landlordId,
    propertyId: item.propertyId,
    propertyName: item.propertyName,
    unitId: item.unitId,
    unitNumber: item.unitNumber,
    leaseId: item.leaseId,
    leaseStatus: item.leaseStatus,
    screeningStatus: item.screeningStatus,
    moveInStatus: item.moveInStatus,
    currentLeaseStartDate: item.currentLeaseStartDate,
    currentLeaseEndDate: item.currentLeaseEndDate,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    "flags.missingLeaseLink": item.flags.missingLeaseLink,
    "flags.missingPropertyLink": item.flags.missingPropertyLink,
    "flags.hasScreening": item.flags.hasScreening,
  }));
  return {
    filename: `admin-tenants-${todayStamp()}.csv`,
    content: toCsv(headers, rows),
    rowCount: rows.length,
    capped: result.total > rows.length,
  };
}

export async function buildAdminLeasesCsv(query?: AdminLeasesQuery) {
  const result = await listAdminLeases(exportQuery(query));
  const headers = [
    "id",
    "propertyId",
    "propertyName",
    "unitId",
    "unitNumber",
    "landlordId",
    "tenantIds",
    "tenantNames",
    "status",
    "monthlyRent",
    "startDate",
    "endDate",
    "riskGrade",
    "createdAt",
    "updatedAt",
    "integrity.hasIssues",
    "integrity.duplicateAgreement",
    "integrity.occupancyMismatch",
  ];
  const rows = result.items.map((item: AdminLeaseView) => ({
    id: item.id,
    propertyId: item.propertyId,
    propertyName: item.propertyName,
    unitId: item.unitId,
    unitNumber: item.unitNumber,
    landlordId: item.landlordId,
    tenantIds: item.tenantIds,
    tenantNames: item.tenantNames,
    status: item.status,
    monthlyRent: item.monthlyRent,
    startDate: item.startDate,
    endDate: item.endDate,
    riskGrade: item.riskGrade,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    "integrity.hasIssues": item.integrity.hasIssues,
    "integrity.duplicateAgreement": item.integrity.duplicateAgreement,
    "integrity.occupancyMismatch": item.integrity.occupancyMismatch,
  }));
  return {
    filename: `admin-leases-${todayStamp()}.csv`,
    content: toCsv(headers, rows),
    rowCount: rows.length,
    capped: result.total > rows.length,
  };
}

export async function buildAdminIntegrityCsv() {
  const result: AdminIntegrityView = await loadAdminIntegrity();
  const headers = [
    "sectionKey",
    "sectionLabel",
    "severity",
    "count",
    "description",
    "sampleId",
    "sampleType",
    "sampleLabel",
    "propertyId",
    "leaseId",
    "tenantId",
    "relatedAdminPath",
  ];
  const rows = result.sections
    .filter((section) => section.count > 0)
    .flatMap((section) => {
      if (!section.samples.length) {
        return [
          {
            sectionKey: section.key,
            sectionLabel: section.label,
            severity: section.severity,
            count: section.count,
            description: section.description,
            sampleId: "",
            sampleType: "",
            sampleLabel: "",
            propertyId: "",
            leaseId: "",
            tenantId: "",
            relatedAdminPath: "",
          },
        ];
      }
      return section.samples.map((sample) => ({
        sectionKey: section.key,
        sectionLabel: section.label,
        severity: section.severity,
        count: section.count,
        description: section.description,
        sampleId: sample.id,
        sampleType: sample.type,
        sampleLabel: sample.label,
        propertyId: sample.propertyId || "",
        leaseId: sample.leaseId || "",
        tenantId: sample.tenantId || "",
        relatedAdminPath: sample.relatedAdminPath || "",
      }));
    });
  return {
    filename: `admin-integrity-${todayStamp()}.csv`,
    content: toCsv(headers, rows),
    rowCount: rows.length,
    capped: false,
  };
}
