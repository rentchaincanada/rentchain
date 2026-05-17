import crypto from "crypto";
import Papa from "papaparse";

export type PaymentImportConfidence = "high" | "medium" | "low" | "invalid";
export type PaymentImportMatchStatus = "matched" | "unmatched" | "ambiguous" | "invalid";

export type PaymentImportTenant = {
  id: string;
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
  landlordId?: string | null;
};

export type PaymentImportLease = {
  id: string;
  tenantId?: string | null;
  primaryTenantId?: string | null;
  tenantIds?: string[] | null;
  landlordId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  unitNumber?: string | null;
  unitLabel?: string | null;
  status?: string | null;
  archivedAt?: unknown;
};

export type PaymentImportProperty = {
  id: string;
  name?: string | null;
  address?: string | null;
  addressLine1?: string | null;
  propertyName?: string | null;
  displayName?: string | null;
};

export type PaymentImportUnit = {
  id: string;
  propertyId?: string | null;
  unitNumber?: string | null;
  unitLabel?: string | null;
  label?: string | null;
  name?: string | null;
  displayLabel?: string | null;
};

export type PaymentImportPreviewRow = {
  rowId: string;
  sourceRowNumber: number;
  sourceFileName: string;
  tenantName: string | null;
  tenantEmail: string | null;
  property: string | null;
  unit: string | null;
  amountCents: number | null;
  amountDisplay: string | null;
  paymentDate: string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  matchStatus: PaymentImportMatchStatus;
  confidence: PaymentImportConfidence;
  preselected: boolean;
  warning: string | null;
  reason: string;
  matchedTenantId: string | null;
  matchedTenantName: string | null;
  leaseId: string | null;
  propertyId: string | null;
  propertyLabel: string | null;
  unitId: string | null;
  unitLabel: string | null;
  duplicateInFile: boolean;
  rowFingerprint: string;
};

export type PaymentImportPreviewResult = {
  ok: true;
  importBatchId: string;
  filename: string;
  summary: {
    totalRows: number;
    totalPaymentAmountCents: number;
    totalPaymentAmountDisplay: string;
    matchedRows: number;
    highConfidenceRows: number;
    mediumConfidenceRows: number;
    lowConfidenceRows: number;
    unmatchedRows: number;
    ambiguousRows: number;
    invalidRows: number;
    preselectedRows: number;
    duplicateRows: number;
    groupedByProperty: Array<{
      propertyLabel: string;
      rowCount: number;
      amountCents: number;
      amountDisplay: string;
    }>;
  };
  rows: PaymentImportPreviewRow[];
};

type Candidate = {
  tenant: PaymentImportTenant;
  lease: PaymentImportLease;
  propertyId: string | null;
  propertyLabel: string | null;
  unitId: string | null;
  unitLabel: string | null;
  active: boolean;
};

const HEADER_ALIASES: Record<string, string> = {
  tenantname: "tenantName",
  tenant: "tenantName",
  name: "tenantName",
  renter: "tenantName",
  tenantemail: "tenantEmail",
  email: "tenantEmail",
  amount: "amount",
  paymentamount: "amount",
  paidamount: "amount",
  paymentdate: "paymentDate",
  paidat: "paymentDate",
  date: "paymentDate",
  effectivedate: "paymentDate",
  property: "property",
  propertyname: "property",
  address: "property",
  unit: "unit",
  unitnumber: "unit",
  unitlabel: "unit",
  method: "method",
  paymentmethod: "method",
  reference: "reference",
  ref: "reference",
  notes: "notes",
  note: "notes",
};

function normalizeHeader(value: unknown): string {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeMatch(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function clean(value: unknown, max = 500): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return raw.slice(0, max);
}

function formatCurrencyCents(cents: number): string {
  const amount = Math.abs(cents) / 100;
  return `${cents < 0 ? "-" : ""}$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toIsoDate(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function parseAmountCents(value: unknown): number | null {
  const raw = String(value || "")
    .trim()
    .replace(/[$,\s]/g, "");
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function propertyLabel(property?: PaymentImportProperty | null): string | null {
  if (!property) return null;
  return (
    clean(property.name, 160) ||
    clean(property.propertyName, 160) ||
    clean(property.displayName, 160) ||
    clean(property.addressLine1, 160) ||
    clean(property.address, 160) ||
    null
  );
}

function unitLabel(unit?: PaymentImportUnit | null): string | null {
  if (!unit) return null;
  const label =
    clean(unit.unitNumber, 80) ||
    clean(unit.unitLabel, 80) ||
    clean(unit.displayLabel, 80) ||
    clean(unit.label, 80) ||
    clean(unit.name, 80) ||
    null;
  return label ? (label.toLowerCase().startsWith("unit") ? label : `Unit ${label}`) : null;
}

function tenantName(tenant: PaymentImportTenant): string {
  return clean(tenant.fullName, 160) || clean(tenant.name, 160) || "Tenant";
}

function leaseTenantIds(lease: PaymentImportLease): string[] {
  return Array.from(
    new Set(
      [
        lease.tenantId,
        lease.primaryTenantId,
        ...(Array.isArray(lease.tenantIds) ? lease.tenantIds : []),
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function isActiveLease(lease: PaymentImportLease): boolean {
  if (lease.archivedAt) return false;
  const status = normalizeMatch(lease.status);
  if (!status) return false;
  if (["active", "lease signed", "signed", "executed"].includes(status)) return true;
  return false;
}

function normalizeRawRow(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw || {})) {
    const normalized = HEADER_ALIASES[normalizeHeader(key)];
    if (normalized) out[normalized] = String(value ?? "").trim();
  }
  return out;
}

function buildCandidates(params: {
  tenants: PaymentImportTenant[];
  leases: PaymentImportLease[];
  properties: PaymentImportProperty[];
  units: PaymentImportUnit[];
}): Candidate[] {
  const tenantsById = new Map(params.tenants.map((tenant) => [String(tenant.id), tenant]));
  const propertiesById = new Map(params.properties.map((property) => [String(property.id), property]));
  const unitsById = new Map(params.units.map((unit) => [String(unit.id), unit]));
  const candidates: Candidate[] = [];

  for (const lease of params.leases) {
    for (const tenantId of leaseTenantIds(lease)) {
      const tenant = tenantsById.get(tenantId);
      if (!tenant) continue;
      const propertyId = clean(lease.propertyId, 120);
      const unitId = clean(lease.unitId, 120);
      const unit = unitId ? unitsById.get(unitId) : null;
      candidates.push({
        tenant,
        lease,
        propertyId,
        propertyLabel: propertyLabel(propertyId ? propertiesById.get(propertyId) : null),
        unitId,
        unitLabel: unitLabel(unit) || (lease.unitNumber ? `Unit ${lease.unitNumber}` : clean(lease.unitLabel, 80)),
        active: isActiveLease(lease),
      });
    }
  }

  return candidates;
}

function propertyMatches(candidate: Candidate, value: string | null): boolean {
  if (!value) return true;
  const key = normalizeMatch(value);
  return Boolean(
    key &&
      (normalizeMatch(candidate.propertyId) === key ||
        normalizeMatch(candidate.propertyLabel) === key)
  );
}

function unitMatches(candidate: Candidate, value: string | null): boolean {
  if (!value) return true;
  const key = normalizeMatch(value);
  const compactKey = key.replace(/^unit\s+/, "");
  const candidateKeys = [
    candidate.unitId,
    candidate.unitLabel,
    candidate.lease.unitNumber,
    candidate.lease.unitLabel,
  ].map((candidateValue) => normalizeMatch(candidateValue));
  return Boolean(
    key &&
      candidateKeys.some(
        (candidateKey) => candidateKey === key || candidateKey.replace(/^unit\s+/, "") === compactKey
      )
  );
}

function exactTenantNameMatches(candidate: Candidate, value: string | null): boolean {
  const key = normalizeMatch(value);
  return Boolean(key && normalizeMatch(tenantName(candidate.tenant)) === key);
}

function exactEmailMatches(candidate: Candidate, value: string | null): boolean {
  const key = String(value || "").trim().toLowerCase();
  return Boolean(key && String(candidate.tenant.email || "").trim().toLowerCase() === key);
}

function unique(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.lease.id}:${candidate.tenant.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveMatch(params: {
  tenantNameValue: string | null;
  tenantEmail: string | null;
  property: string | null;
  unit: string | null;
  candidates: Candidate[];
}): {
  status: PaymentImportMatchStatus;
  confidence: PaymentImportConfidence;
  candidate: Candidate | null;
  reason: string;
  warning: string | null;
} {
  const activeCandidates = params.candidates.filter((candidate) => candidate.active);

  const emailMatches = unique(activeCandidates.filter((candidate) => exactEmailMatches(candidate, params.tenantEmail)));
  if (emailMatches.length === 1) {
    return {
      status: "matched",
      confidence: "high",
      candidate: emailMatches[0],
      reason: "Email matched a tenant with an active lease.",
      warning: null,
    };
  }
  if (emailMatches.length > 1) {
    return {
      status: "ambiguous",
      confidence: "low",
      candidate: null,
      reason: "Tenant email matched multiple active lease records.",
      warning: "Ambiguous tenant match. Do not import this row until the tenant is resolved.",
    };
  }

  const namePropertyUnit = unique(
    activeCandidates.filter(
      (candidate) =>
        exactTenantNameMatches(candidate, params.tenantNameValue) &&
        propertyMatches(candidate, params.property) &&
        unitMatches(candidate, params.unit) &&
        Boolean(params.property) &&
        Boolean(params.unit)
    )
  );
  if (namePropertyUnit.length === 1) {
    return {
      status: "matched",
      confidence: "high",
      candidate: namePropertyUnit[0],
      reason: "Tenant name, property, and unit matched an active lease.",
      warning: null,
    };
  }
  if (namePropertyUnit.length > 1) {
    return {
      status: "ambiguous",
      confidence: "low",
      candidate: null,
      reason: "Tenant name, property, and unit matched multiple active leases.",
      warning: "Ambiguous tenant match. Do not import this row until the tenant is resolved.",
    };
  }

  const nameProperty = unique(
    activeCandidates.filter(
      (candidate) =>
        exactTenantNameMatches(candidate, params.tenantNameValue) &&
        propertyMatches(candidate, params.property) &&
        Boolean(params.property)
    )
  );
  if (nameProperty.length === 1) {
    return {
      status: "matched",
      confidence: "medium",
      candidate: nameProperty[0],
      reason: "Tenant name and property matched an active lease, but unit was missing or not resolved.",
      warning: "Review required before import because unit matching is incomplete.",
    };
  }
  if (nameProperty.length > 1) {
    return {
      status: "ambiguous",
      confidence: "low",
      candidate: null,
      reason: "Tenant name and property matched multiple active leases.",
      warning: "Ambiguous tenant match. Do not import this row until the unit is resolved.",
    };
  }

  const nameOnly = unique(activeCandidates.filter((candidate) => exactTenantNameMatches(candidate, params.tenantNameValue)));
  if (nameOnly.length === 1) {
    return {
      status: "matched",
      confidence: "low",
      candidate: nameOnly[0],
      reason: "Tenant name matched one active lease, but property/unit context is incomplete.",
      warning: "Name-only matches are not preselected for import.",
    };
  }
  if (nameOnly.length > 1) {
    return {
      status: "ambiguous",
      confidence: "low",
      candidate: null,
      reason: "Tenant name matched multiple active leases.",
      warning: "Ambiguous tenant match. Do not import this row until property and unit are resolved.",
    };
  }

  const inactiveName = unique(
    params.candidates.filter(
      (candidate) => !candidate.active && exactTenantNameMatches(candidate, params.tenantNameValue)
    )
  );
  if (inactiveName.length) {
    return {
      status: "unmatched",
      confidence: "low",
      candidate: inactiveName[0],
      reason: "Tenant name matched only inactive or past lease context.",
      warning: "Inactive or past tenant context is blocked from import.",
    };
  }

  return {
    status: "unmatched",
    confidence: "low",
    candidate: null,
    reason: "No active tenant lease match found.",
    warning: "Unmatched rows are not imported.",
  };
}

function fingerprintRow(row: {
  tenantNameValue: string | null;
  tenantEmail: string | null;
  property: string | null;
  unit: string | null;
  amountCents: number | null;
  paymentDate: string | null;
  reference: string | null;
}) {
  return crypto
    .createHash("sha256")
    .update(
      [
        normalizeMatch(row.tenantNameValue),
        String(row.tenantEmail || "").trim().toLowerCase(),
        normalizeMatch(row.property),
        normalizeMatch(row.unit),
        String(row.amountCents || ""),
        String(row.paymentDate || ""),
        normalizeMatch(row.reference),
      ].join("|")
    )
    .digest("hex");
}

export function previewPaymentCsvImport(params: {
  filename: string;
  csvText: string;
  tenants: PaymentImportTenant[];
  leases: PaymentImportLease[];
  properties: PaymentImportProperty[];
  units: PaymentImportUnit[];
}): PaymentImportPreviewResult {
  const filename = clean(params.filename, 180) || "payment-import.csv";
  const parsed = Papa.parse<Record<string, unknown>>(params.csvText || "", {
    header: true,
    skipEmptyLines: true,
  });

  const candidates = buildCandidates(params);
  const rows: PaymentImportPreviewRow[] = [];

  parsed.data.forEach((rawRow, index) => {
    const normalized = normalizeRawRow(rawRow || {});
    const tenantNameValue = clean(normalized.tenantName, 160);
    const tenantEmail = clean(normalized.tenantEmail, 180);
    const property = clean(normalized.property, 180);
    const unit = clean(normalized.unit, 80);
    const amountCents = parseAmountCents(normalized.amount);
    const paymentDate = toIsoDate(normalized.paymentDate);
    const method = clean(normalized.method, 80);
    const reference = clean(normalized.reference, 120);
    const notes = clean(normalized.notes, 1000);
    const rowFingerprint = fingerprintRow({
      tenantNameValue,
      tenantEmail,
      property,
      unit,
      amountCents,
      paymentDate,
      reference,
    });

    const validationErrors = [
      !tenantNameValue ? "tenantName is required." : "",
      !amountCents ? "amount must be a positive payment amount." : "",
      !paymentDate ? "paymentDate is required and must be a valid date." : "",
    ].filter(Boolean);

    if (validationErrors.length) {
      rows.push({
        rowId: `${filename}:row-${index + 1}`,
        sourceRowNumber: index + 2,
        sourceFileName: filename,
        tenantName: tenantNameValue,
        tenantEmail,
        property,
        unit,
        amountCents,
        amountDisplay: amountCents ? formatCurrencyCents(amountCents) : null,
        paymentDate,
        method,
        reference,
        notes,
        matchStatus: "invalid",
        confidence: "invalid",
        preselected: false,
        warning: validationErrors.join(" "),
        reason: validationErrors.join(" "),
        matchedTenantId: null,
        matchedTenantName: null,
        leaseId: null,
        propertyId: null,
        propertyLabel: property || "Unresolved property",
        unitId: null,
        unitLabel: unit || null,
        duplicateInFile: false,
        rowFingerprint,
      });
      return;
    }

    const match = resolveMatch({
      tenantNameValue,
      tenantEmail,
      property,
      unit,
      candidates,
    });
    const candidate = match.candidate;
    const preselected = match.status === "matched" && match.confidence === "high";

    rows.push({
      rowId: `${filename}:row-${index + 1}`,
      sourceRowNumber: index + 2,
      sourceFileName: filename,
      tenantName: tenantNameValue,
      tenantEmail,
      property,
      unit,
      amountCents,
      amountDisplay: formatCurrencyCents(amountCents || 0),
      paymentDate,
      method,
      reference,
      notes,
      matchStatus: match.status,
      confidence: match.confidence,
      preselected,
      warning: match.warning,
      reason: match.reason,
      matchedTenantId: candidate?.tenant.id || null,
      matchedTenantName: candidate ? tenantName(candidate.tenant) : null,
      leaseId: candidate?.lease.id || null,
      propertyId: candidate?.propertyId || null,
      propertyLabel: candidate?.propertyLabel || property || "Unresolved property",
      unitId: candidate?.unitId || null,
      unitLabel: candidate?.unitLabel || unit || null,
      duplicateInFile: false,
      rowFingerprint,
    });
  });

  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.rowFingerprint, (counts.get(row.rowFingerprint) || 0) + 1));
  rows.forEach((row) => {
    row.duplicateInFile = (counts.get(row.rowFingerprint) || 0) > 1;
    if (row.duplicateInFile) {
      row.preselected = false;
      row.warning = row.warning
        ? `${row.warning} Potential duplicate row in uploaded CSV.`
        : "Potential duplicate row in uploaded CSV.";
    }
  });

  const grouped = new Map<string, { rowCount: number; amountCents: number }>();
  rows.forEach((row) => {
    const key = row.propertyLabel || "Unresolved property";
    const existing = grouped.get(key) || { rowCount: 0, amountCents: 0 };
    existing.rowCount += 1;
    existing.amountCents += row.amountCents || 0;
    grouped.set(key, existing);
  });

  const totalPaymentAmountCents = rows.reduce((sum, row) => sum + (row.amountCents || 0), 0);
  return {
    ok: true,
    importBatchId: crypto
      .createHash("sha256")
      .update(`${filename}\n${params.csvText || ""}`)
      .digest("hex")
      .slice(0, 24),
    filename,
    rows,
    summary: {
      totalRows: rows.length,
      totalPaymentAmountCents,
      totalPaymentAmountDisplay: formatCurrencyCents(totalPaymentAmountCents),
      matchedRows: rows.filter((row) => row.matchStatus === "matched").length,
      highConfidenceRows: rows.filter((row) => row.confidence === "high").length,
      mediumConfidenceRows: rows.filter((row) => row.confidence === "medium").length,
      lowConfidenceRows: rows.filter((row) => row.confidence === "low").length,
      unmatchedRows: rows.filter((row) => row.matchStatus === "unmatched").length,
      ambiguousRows: rows.filter((row) => row.matchStatus === "ambiguous").length,
      invalidRows: rows.filter((row) => row.matchStatus === "invalid").length,
      preselectedRows: rows.filter((row) => row.preselected).length,
      duplicateRows: rows.filter((row) => row.duplicateInFile).length,
      groupedByProperty: Array.from(grouped.entries())
        .map(([propertyLabel, value]) => ({
          propertyLabel,
          rowCount: value.rowCount,
          amountCents: value.amountCents,
          amountDisplay: formatCurrencyCents(value.amountCents),
        }))
        .sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel)),
    },
  };
}
