import { db } from "../firebase";
import { EVIDENCE_RECORD_COLLECTION, type EvidenceRecord } from "../types/evidence-record-types";
import type { ExportAuditEventPayload } from "../types/export-audit-types";
import { CANONICAL_EVENTS_COLLECTION } from "../lib/events/buildEvent";
import { generateExportAuditSafeReference, type ExportAuditTrailFirestoreLike } from "./export-audit-trail-service";
import type { PortableAttestation } from "../lib/portableAttestations/portableAttestationTypes";
import type {
  InstitutionalTrustExportAudience,
  InstitutionalTrustExportPurpose,
} from "../lib/institutionTrustExports/institutionTrustExportTypes";
import type { DeriveCrossOrganizationTrustInput } from "../lib/crossOrganizationTrust/crossOrganizationTrustTypes";
import {
  assembleTrustWorkspaceSummary,
  type TrustWorkspaceDerivationInput,
} from "../lib/trustWorkspace/deriveTrustWorkspace";
import { emitTrustWorkspaceDerivedEvent } from "../lib/trustWorkspace/trustWorkspaceEventEmission";
import { projectTrustWorkspace } from "../lib/trustWorkspace/trustWorkspaceProjections";
import type {
  TrustWorkspaceAccessContext,
  TrustWorkspaceErrorResponse,
  TrustWorkspaceRole,
  TrustWorkspaceServiceResult,
} from "../lib/trustWorkspace/trustWorkspaceTypes";

export type TrustWorkspaceUser = {
  id?: string | null;
  sub?: string | null;
  role?: string | null;
  landlordId?: string | null;
  tenantId?: string | null;
  evidenceRefs?: string[] | null;
  tenantEvidenceRefs?: string[] | null;
  attestationEvidenceRefs?: string[] | null;
};

export type TrustWorkspaceServiceOptions = Omit<TrustWorkspaceDerivationInput, "context"> & {
  firestore?: ExportAuditTrailFirestoreLike;
  emitEvent?: boolean;
};

type QuerySnapshot<T> = {
  docs?: Array<{ data: () => T }>;
};

function roleFromUser(user: TrustWorkspaceUser): TrustWorkspaceRole | null {
  const role = String(user.role || "").toLowerCase();
  if (role === "tenant") return "tenant";
  if (role === "landlord") return "landlord";
  if (role === "admin") return "admin";
  if (role === "support" || role === "adminsupport") return "support";
  return null;
}

function safeEvidenceRefs(user: TrustWorkspaceUser): TrustWorkspaceAccessContext["allowedEvidenceRefs"] {
  const refs = [
    ...(user.evidenceRefs || []),
    ...(user.tenantEvidenceRefs || []),
    ...(user.attestationEvidenceRefs || []),
  ];
  return refs
    .map((value) => String(value || "").trim())
    .filter((value): value is TrustWorkspaceAccessContext["allowedEvidenceRefs"][number] =>
      /^[a-z][a-z0-9_.:-]*:[a-f0-9][a-z0-9_.:-]{11,160}$/i.test(value)
    );
}

export function buildTrustWorkspaceAccessContext(user: TrustWorkspaceUser): TrustWorkspaceAccessContext | null {
  const role = roleFromUser(user);
  if (!role) return null;
  const landlordId = String(user.landlordId || (role === "landlord" ? user.id || "" : "")).trim();
  const tenantId = String(user.tenantId || (role === "tenant" ? user.id || "" : "")).trim();
  return {
    role,
    requesterRef: generateExportAuditSafeReference("actor", user.id || user.sub || "unknown"),
    landlordRef: landlordId ? generateExportAuditSafeReference("landlord", landlordId) : null,
    tenantRef: tenantId ? generateExportAuditSafeReference("tenant", tenantId) : null,
    allowedEvidenceRefs: safeEvidenceRefs(user),
    supportPurpose: role === "support" ? "trust_workspace_support_review" : role === "admin" ? "trust_workspace_admin_review" : null,
    rawIdsIncluded: false,
  };
}

async function loadEvidenceRecords(landlordId: string, firestore?: ExportAuditTrailFirestoreLike): Promise<EvidenceRecord[]> {
  const store = firestore || (db as unknown as ExportAuditTrailFirestoreLike);
  const collection = store.collection<EvidenceRecord>(EVIDENCE_RECORD_COLLECTION);
  const query = collection.where?.("landlordId", "==", landlordId);
  if (!query?.get) return [];
  const snap = (await query.get()) as QuerySnapshot<EvidenceRecord>;
  return snap.docs?.map((doc) => doc.data()) || [];
}

async function loadAuditEvents(landlordRef: string, firestore?: ExportAuditTrailFirestoreLike): Promise<ExportAuditEventPayload[]> {
  const store = firestore || (db as unknown as ExportAuditTrailFirestoreLike);
  const collection = store.collection<ExportAuditEventPayload>(CANONICAL_EVENTS_COLLECTION);
  const query = collection.where?.("landlordReferenceId", "==", landlordRef);
  if (!query?.get) return [];
  const snap = (await query.get()) as QuerySnapshot<ExportAuditEventPayload>;
  return snap.docs?.map((doc) => doc.data()) || [];
}

function error(code: TrustWorkspaceErrorResponse["code"]): TrustWorkspaceServiceResult {
  return {
    ok: false,
    code,
    error: code,
    metadataOnly: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export async function getTrustWorkspaceForUser(
  user: TrustWorkspaceUser,
  options: TrustWorkspaceServiceOptions = {}
): Promise<TrustWorkspaceServiceResult> {
  const context = buildTrustWorkspaceAccessContext(user);
  if (!context) return error("TRUST_WORKSPACE_INVALID_ROLE");
  const landlordId = String(user.landlordId || (context.role === "landlord" ? user.id || "" : "")).trim();
  if ((context.role === "landlord" || context.role === "support") && !landlordId) return error("TRUST_WORKSPACE_MISSING_SCOPE");
  if (context.role === "tenant" && !context.allowedEvidenceRefs.length) return error("TRUST_WORKSPACE_MISSING_SCOPE");
  try {
    const evidenceRecords =
      options.evidenceRecords || (landlordId ? await loadEvidenceRecords(landlordId, options.firestore) : []);
    const auditEvents =
      options.auditEvents || (context.landlordRef ? await loadAuditEvents(context.landlordRef, options.firestore) : []);
    const summary = await assembleTrustWorkspaceSummary({
      ...options,
      context,
      evidenceRecords,
      auditEvents,
      portableAttestations: options.portableAttestations as readonly PortableAttestation[] | undefined,
      exportReadinessRequests: options.exportReadinessRequests as
        | readonly Array<{
            audience: InstitutionalTrustExportAudience;
            purpose: InstitutionalTrustExportPurpose;
            exportRef?: string | null;
          }>
        | undefined,
      crossOrgInput: options.crossOrgInput as Omit<DeriveCrossOrganizationTrustInput, "landlordId" | "generatedAt"> | null | undefined,
    });
    const projected = projectTrustWorkspace(summary, context);
    if (options.emitEvent !== false && context.landlordRef) {
      await emitTrustWorkspaceDerivedEvent(projected, {
        requesterRef: context.requesterRef,
        landlordScope: context.landlordRef,
        purpose: context.supportPurpose,
        firestore: options.firestore,
      });
    }
    return { ok: true, workspace: projected };
  } catch (serviceError) {
    const message = serviceError instanceof Error ? serviceError.message : "";
    if (message.includes("forbidden")) return error("TRUST_WORKSPACE_FORBIDDEN");
    if (message.includes("scope") || message.includes("context")) return error("TRUST_WORKSPACE_MISSING_SCOPE");
    return error("TRUST_WORKSPACE_DERIVATION_FAILED");
  }
}
