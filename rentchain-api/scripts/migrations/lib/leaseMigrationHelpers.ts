import { Timestamp } from "firebase-admin/firestore";

export type MigrationCliOptions = {
  dryRun: boolean;
  repairExisting: boolean;
  repairUnits: boolean;
  validateOnly: boolean;
  limit: number | null;
  tenantId: string | null;
};

export type DerivedLeaseSnapshot = {
  tenantId: string;
  propertyId: string | null;
  unitId: string | null;
  monthlyRent: number | null;
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  status: string;
  createdAt: Timestamp | null;
  derivedFrom: string[];
  currentLeaseHeuristicMatched: boolean;
};

export type TenantActionReport = {
  tenantId: string;
  tenantName: string | null;
  propertyId: string | null;
  unitId: string | null;
  status: string;
  action:
    | "skipped_missing_property"
    | "skipped_missing_unit"
    | "skipped_existing"
    | "will_create"
    | "created"
    | "validated_missing"
    | "validated_existing"
    | "repaired_existing"
    | "unit_repaired"
    | "unresolved"
    | "error";
  reasons: string[];
  existingLeaseId?: string | null;
  createdLeaseId?: string | null;
  repairedFields?: string[];
  unitRepairFields?: string[];
  monthlyRent?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  diagnostics?: Record<string, unknown>;
};

const PROPERTY_ID_PATHS = [
  "propertyId",
  "propertyRef",
  "property.id",
  "property.ref",
  "lease.propertyId",
  "lease.propertyRef",
  "lease.property.id",
  "currentLease.propertyId",
  "currentLease.propertyRef",
];

const UNIT_ID_PATHS = [
  "unitId",
  "unitRef",
  "unit",
  "lease.unitId",
  "lease.unitRef",
  "lease.unit",
  "lease.unit.id",
  "currentLease.unitId",
  "currentLease.unitRef",
  "currentLease.unit",
  "currentLease.unit.id",
];

const RENT_PATHS = [
  "monthlyRent",
  "rent",
  "lease.monthlyRent",
  "lease.rent",
  "currentLease.monthlyRent",
  "currentLease.rent",
];

const START_DATE_PATHS = [
  "leaseStart",
  "startDate",
  "lease.startDate",
  "lease.leaseStart",
  "lease.leaseStartDate",
  "currentLease.startDate",
  "currentLease.leaseStart",
];

const END_DATE_PATHS = [
  "leaseEnd",
  "endDate",
  "lease.endDate",
  "lease.leaseEnd",
  "lease.leaseEndDate",
  "currentLease.endDate",
  "currentLease.leaseEnd",
];

const STATUS_PATHS = [
  "leaseStatus",
  "status",
  "tenantStatus",
  "lease.status",
  "lease.leaseStatus",
  "currentLease.status",
];

const CREATED_AT_PATHS = [
  "createdAt",
  "created_at",
  "lease.createdAt",
  "lease.updatedAt",
  "updatedAt",
];

export function parseCliArgs(argv: string[]): MigrationCliOptions {
  let dryRun = false;
  let repairExisting = false;
  let repairUnits = false;
  let validateOnly = false;
  let limit: number | null = null;
  let tenantId: string | null = null;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--repair-existing") repairExisting = true;
    else if (arg === "--repair-units") repairUnits = true;
    else if (arg === "--validate-only") validateOnly = true;
    else if (arg.startsWith("--limit=")) {
      const parsed = Number(arg.slice("--limit=".length));
      limit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
    } else if (arg.startsWith("--tenant-id=")) {
      tenantId = String(arg.slice("--tenant-id=".length) || "").trim() || null;
    }
  }

  return { dryRun, repairExisting, repairUnits, validateOnly, limit, tenantId };
}

export function getDeepValue(source: unknown, path: string): unknown {
  if (!source || typeof source !== "object") return undefined;
  const segments = path.split(".");
  let current: any = source;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[segment];
  }
  return current;
}

export function pickFirstValue(source: unknown, paths: string[]): { value: unknown; path: string | null } {
  for (const path of paths) {
    const value = getDeepValue(source, path);
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return { value, path };
    }
  }
  return { value: null, path: null };
}

export function normalizeStringId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object") {
    const candidate = (value as Record<string, unknown>).id ?? (value as Record<string, unknown>).ref;
    if (candidate != null) return normalizeStringId(candidate);
  }
  const normalized = String(value).trim();
  return normalized || null;
}

export function parseMoney(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value).replace(/[$,\s]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseTimestamp(value: unknown): Timestamp | null {
  if (value == null || value === "") return null;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return Timestamp.fromDate(value);
  }
  if (typeof value === "object" && value && typeof (value as any).toDate === "function") {
    try {
      const date = (value as any).toDate();
      if (date instanceof Date && Number.isFinite(date.getTime())) {
        return Timestamp.fromDate(date);
      }
    } catch {
      return null;
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    return Timestamp.fromMillis(millis);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return null;
    const millis = numeric > 10_000_000_000 ? numeric : numeric * 1000;
    return Timestamp.fromMillis(millis);
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return Timestamp.fromMillis(parsed);
}

export function timestampToReportValue(value: Timestamp | null): string | null {
  if (!value) return null;
  return value.toDate().toISOString();
}

export function normalizeLegacyLeaseStatus(rawStatus: unknown, linkageExists: boolean, endDate: Timestamp | null): { status: string; heuristicMatched: boolean } {
  const normalized = String(rawStatus || "").trim().toLowerCase();
  if (["active", "current", "occupied", "good_standing"].includes(normalized)) {
    return { status: "active", heuristicMatched: false };
  }
  if (["notice_pending", "notice pending", "notice-given"].includes(normalized)) {
    return { status: "notice_pending", heuristicMatched: false };
  }
  if (["renewal_pending", "renewal pending"].includes(normalized)) {
    return { status: "renewal_pending", heuristicMatched: false };
  }
  if (["renewal_accepted", "renewed", "accepted", "renew"].includes(normalized)) {
    return { status: "renewal_accepted", heuristicMatched: false };
  }
  if (["move_out_pending", "quitting", "quit", "move out pending"].includes(normalized)) {
    return { status: "move_out_pending", heuristicMatched: false };
  }
  if (["ended", "expired", "inactive", "past", "terminated"].includes(normalized)) {
    return { status: "ended", heuristicMatched: false };
  }

  if (linkageExists) {
    const now = Date.now();
    if (endDate && endDate.toMillis() >= now) {
      return { status: "active", heuristicMatched: true };
    }
    if (!endDate && ["current", "active"].includes(String(rawStatus || "").trim().toLowerCase())) {
      return { status: "active", heuristicMatched: true };
    }
    if (!endDate && !normalized) {
      return { status: "active", heuristicMatched: true };
    }
  }

  return { status: "unknown", heuristicMatched: false };
}

export function isCurrentCanonicalLeaseStatus(status: unknown): boolean {
  return ["active", "notice_pending", "renewal_pending", "renewal_accepted", "move_out_pending"].includes(
    String(status || "").trim().toLowerCase()
  );
}

export function derivePropertyId(tenantData: Record<string, unknown>): { value: string | null; path: string | null } {
  const picked = pickFirstValue(tenantData, PROPERTY_ID_PATHS);
  return { value: normalizeStringId(picked.value), path: picked.path };
}

export function deriveUnitId(tenantData: Record<string, unknown>): { value: string | null; path: string | null } {
  const picked = pickFirstValue(tenantData, UNIT_ID_PATHS);
  return { value: normalizeStringId(picked.value), path: picked.path };
}

export function deriveMonthlyRent(tenantData: Record<string, unknown>): { value: number | null; path: string | null } {
  const picked = pickFirstValue(tenantData, RENT_PATHS);
  return { value: parseMoney(picked.value), path: picked.path };
}

export function deriveLeaseStart(tenantData: Record<string, unknown>): { value: Timestamp | null; path: string | null } {
  const picked = pickFirstValue(tenantData, START_DATE_PATHS);
  return { value: parseTimestamp(picked.value), path: picked.path };
}

export function deriveLeaseEnd(tenantData: Record<string, unknown>): { value: Timestamp | null; path: string | null } {
  const picked = pickFirstValue(tenantData, END_DATE_PATHS);
  return { value: parseTimestamp(picked.value), path: picked.path };
}

export function deriveStatus(tenantData: Record<string, unknown>, linkageExists: boolean, endDate: Timestamp | null): { value: string; path: string | null; heuristicMatched: boolean } {
  const picked = pickFirstValue(tenantData, STATUS_PATHS);
  const normalized = normalizeLegacyLeaseStatus(picked.value, linkageExists, endDate);
  return { value: normalized.status, path: picked.path, heuristicMatched: normalized.heuristicMatched };
}

export function deriveCreatedAt(tenantData: Record<string, unknown>): { value: Timestamp | null; path: string | null } {
  const picked = pickFirstValue(tenantData, CREATED_AT_PATHS);
  return { value: parseTimestamp(picked.value), path: picked.path };
}

export function deriveLeaseSnapshot(tenantId: string, tenantData: Record<string, unknown>): DerivedLeaseSnapshot {
  const property = derivePropertyId(tenantData);
  const unit = deriveUnitId(tenantData);
  const rent = deriveMonthlyRent(tenantData);
  const start = deriveLeaseStart(tenantData);
  const end = deriveLeaseEnd(tenantData);
  const createdAt = deriveCreatedAt(tenantData);
  const linkageExists = Boolean(property.value && unit.value);
  const status = deriveStatus(tenantData, linkageExists, end.value);
  const derivedFrom = [property.path, unit.path, rent.path, start.path, end.path, status.path, createdAt.path].filter(
    (value): value is string => Boolean(value)
  );

  return {
    tenantId,
    propertyId: property.value,
    unitId: unit.value,
    monthlyRent: rent.value,
    startDate: start.value,
    endDate: end.value,
    status: status.value,
    createdAt: createdAt.value,
    derivedFrom,
    currentLeaseHeuristicMatched: status.heuristicMatched,
  };
}

export function buildLeaseCreateData(snapshot: DerivedLeaseSnapshot) {
  return {
    tenantId: snapshot.tenantId,
    propertyId: snapshot.propertyId,
    unitId: snapshot.unitId,
    monthlyRent: snapshot.monthlyRent,
    startDate: snapshot.startDate,
    endDate: snapshot.endDate,
    status: snapshot.status,
    source: "legacy-tenant-migration",
    migratedAt: "SERVER_TIMESTAMP" as const,
    createdAt: snapshot.createdAt,
    updatedAt: "SERVER_TIMESTAMP" as const,
  };
}

export function buildExistingLeaseRepairPatch(existing: Record<string, unknown>, snapshot: DerivedLeaseSnapshot) {
  const patch: Record<string, unknown> = {};
  const repairedFields: string[] = [];

  const maybeSet = (field: string, nextValue: unknown, shouldSet: boolean) => {
    if (!shouldSet) return;
    patch[field] = nextValue;
    repairedFields.push(field);
  };

  maybeSet("monthlyRent", snapshot.monthlyRent, (existing.monthlyRent == null || existing.monthlyRent === "") && snapshot.monthlyRent != null);
  maybeSet("startDate", snapshot.startDate, !existing.startDate && !!snapshot.startDate);
  maybeSet("endDate", snapshot.endDate, !existing.endDate && !!snapshot.endDate);
  maybeSet(
    "status",
    snapshot.status,
    (existing.status == null || String(existing.status).trim() === "" || String(existing.status).trim().toLowerCase() === "unknown") &&
      snapshot.status !== "unknown"
  );
  if (repairedFields.length > 0) {
    patch.updatedAt = "SERVER_TIMESTAMP" as const;
  }
  return { patch, repairedFields };
}

export function buildUnitRepairPatch(unitData: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  const repairedFields: string[] = [];
  const status = String(unitData.status || "").trim().toLowerCase();
  if (!status || status === "unknown") {
    patch.status = "occupied";
    repairedFields.push("status");
  }
  if (unitData.isOccupied !== true) {
    patch.isOccupied = true;
    repairedFields.push("isOccupied");
  }
  if (repairedFields.length > 0) {
    patch.updatedAt = "SERVER_TIMESTAMP" as const;
  }
  return { patch, repairedFields };
}

export function isMissingLinkage(snapshot: DerivedLeaseSnapshot) {
  return {
    missingPropertyId: !snapshot.propertyId,
    missingUnitId: !snapshot.unitId,
  };
}
