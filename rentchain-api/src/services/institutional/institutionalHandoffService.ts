import crypto from "crypto";
import { db } from "../../config/firebase";
import { deriveInstitutionalHandoffStatus, type InstitutionalHandoffStatus } from "./deriveInstitutionalHandoffStatus";

export const INSTITUTIONAL_HANDOFFS_COLLECTION = "institutionalHandoffs";

export type InstitutionType = "bank" | "lender" | "insurer" | "regulator" | "internal_review";
export type InstitutionIntegrationMode = "sandbox" | "manual_export";
export type InstitutionProfileStatus = "draft_only" | "not_connected";

export type InstitutionalHandoffRecord = {
  id: string;
  tenantId: string;
  institutionProfile: {
    institutionType: InstitutionType;
    displayName: string;
    integrationMode: InstitutionIntegrationMode;
    status: InstitutionProfileStatus;
  };
  schema: {
    name: "rentchain.institutional_identity_package";
    version: "2.0";
  };
  compliance: {
    readinessStatus: "not_ready" | "partial" | "ready";
    validationStatus: "valid" | "valid_with_warnings" | "invalid";
  };
  handoffStatus: InstitutionalHandoffStatus;
  exportStorage: "metadata_only";
  outboundTransfer: "none";
  createdAt: string;
  updatedAt: string;
};

type CreateInstitutionalHandoffInput = {
  tenantId: string;
  institutionProfile: {
    institutionType: InstitutionType;
    displayName?: unknown;
    integrationMode?: InstitutionIntegrationMode;
  };
  schema: {
    name: "rentchain.institutional_identity_package";
    version: "2.0";
  };
  compliance: {
    readinessStatus: "not_ready" | "partial" | "ready";
    validationStatus: "valid" | "valid_with_warnings" | "invalid";
  };
};

function fallbackDisplayName(institutionType: InstitutionType): string {
  switch (institutionType) {
    case "bank":
      return "Bank draft";
    case "lender":
      return "Lender draft";
    case "insurer":
      return "Insurer draft";
    case "regulator":
      return "Regulator draft";
    case "internal_review":
    default:
      return "Internal review draft";
  }
}

export function sanitizeInstitutionDisplayName(value: unknown, institutionType: InstitutionType): string {
  if (value == null) {
    return fallbackDisplayName(institutionType);
  }
  if (typeof value !== "string") {
    throw new Error("invalid_institution_display_name");
  }

  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 80);
  return normalized || fallbackDisplayName(institutionType);
}

export async function createInstitutionalHandoffDraft(
  input: CreateInstitutionalHandoffInput
): Promise<InstitutionalHandoffRecord> {
  const tenantId = String(input.tenantId || "").trim();
  if (!tenantId) {
    throw new Error("invalid_tenant_id");
  }

  const institutionType = input.institutionProfile.institutionType;
  const displayName = sanitizeInstitutionDisplayName(input.institutionProfile.displayName, institutionType);
  const integrationMode = input.institutionProfile.integrationMode === "manual_export" ? "manual_export" : "sandbox";
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const record: InstitutionalHandoffRecord = {
    id,
    tenantId,
    institutionProfile: {
      institutionType,
      displayName,
      integrationMode,
      status: "draft_only",
    },
    schema: {
      name: "rentchain.institutional_identity_package",
      version: "2.0",
    },
    compliance: {
      readinessStatus: input.compliance.readinessStatus,
      validationStatus: input.compliance.validationStatus,
    },
    handoffStatus: deriveInstitutionalHandoffStatus({
      validationStatus: input.compliance.validationStatus,
      readinessStatus: input.compliance.readinessStatus,
    }),
    exportStorage: "metadata_only",
    outboundTransfer: "none",
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(INSTITUTIONAL_HANDOFFS_COLLECTION).doc(id).set(record, { merge: false });
  return record;
}

export async function listInstitutionalHandoffsForTenant(tenantId: string): Promise<InstitutionalHandoffRecord[]> {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) return [];

  const snapshot = await db.collection(INSTITUTIONAL_HANDOFFS_COLLECTION).where("tenantId", "==", normalizedTenantId).get();
  return snapshot.docs
    .map((doc: any) => doc.data())
    .filter(Boolean)
    .sort((a: InstitutionalHandoffRecord, b: InstitutionalHandoffRecord) => {
      const aTime = Date.parse(a.updatedAt || a.createdAt || "");
      const bTime = Date.parse(b.updatedAt || b.createdAt || "");
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });
}

export async function softVoidInstitutionalHandoff(
  tenantId: string,
  handoffId: string
): Promise<InstitutionalHandoffRecord | null> {
  const normalizedTenantId = String(tenantId || "").trim();
  const normalizedHandoffId = String(handoffId || "").trim();
  if (!normalizedTenantId || !normalizedHandoffId) return null;

  const ref = db.collection(INSTITUTIONAL_HANDOFFS_COLLECTION).doc(normalizedHandoffId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const current = snap.data() as InstitutionalHandoffRecord | undefined;
  if (!current || String(current.tenantId || "").trim() !== normalizedTenantId) {
    return null;
  }

  const next: InstitutionalHandoffRecord = {
    ...current,
    handoffStatus: "voided",
    updatedAt: new Date().toISOString(),
  };
  await ref.set(next, { merge: false });
  return next;
}
