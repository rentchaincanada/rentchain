import crypto from "crypto";
import { db, FieldValue } from "../../firebase";
import { getSignedDownloadUrl } from "../../lib/gcsSignedUrl";
import { writeCanonicalEvent } from "../../lib/events/buildEvent";
import { putPdfObject } from "../../storage/pdfStore";
import {
  assertAdapterAllowedForGeneration,
  assertAdapterAllowedForSigning,
  getLeaseDocumentAdapter,
  jurisdictionCodeFromLease,
} from "./jurisdictionAdapterRegistry";
import type {
  LeaseDocumentMetadata,
  LeaseDocumentProjection,
  PrimaryLeaseDocumentInput,
} from "./leaseDocumentTypes";

export const LEASE_DOCUMENTS_COLLECTION = "leaseDocuments";
const PROVIDER_ACCESS_MINUTES = 240;

function nowIso() {
  return new Date().toISOString();
}

function digest(input: string | Buffer, length?: number) {
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  return length ? hash.slice(0, length) : hash;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function tenantIdsFromLease(lease: Record<string, any>) {
  const ids = Array.isArray(lease?.tenantIds)
    ? lease.tenantIds
    : [lease?.primaryTenantId, lease?.tenantId];
  return ids.map((value) => String(value || "").trim()).filter(Boolean);
}

function safeProjection(doc: LeaseDocumentMetadata, previewUrl?: string | null): LeaseDocumentProjection {
  return {
    ...doc,
    storageRef: null,
    previewUrl: previewUrl || null,
  };
}

function manifestFor(input: {
  leaseId: string;
  landlordId: string;
  tenantIds: string[];
  jurisdictionCode: string;
  templateVersion: string;
  documentHash: string;
  generatedAt: string;
}) {
  return {
    manifestVersion: "primary_lease_document_manifest_v1",
    documentType: "primary_lease",
    leaseId: input.leaseId,
    landlordId: input.landlordId,
    tenantIds: [...input.tenantIds].sort(),
    jurisdictionCode: input.jurisdictionCode,
    templateVersion: input.templateVersion,
    documentHash: input.documentHash,
    generatedAt: input.generatedAt,
  };
}

async function writeLeaseDocumentEvent(params: {
  action: "lease_document_generated" | "lease_document_locked" | "lease_document_superseded";
  status: string;
  leaseId: string;
  landlordId: string;
  actorId?: string | null;
  document: LeaseDocumentMetadata;
}) {
  await writeCanonicalEvent({
    domain: "lease",
    action: params.action,
    status: params.status,
    actor: { type: "landlord", role: "landlord", id: params.actorId || params.landlordId },
    resource: { type: "lease", id: params.leaseId },
    visibility: "internal",
    summary: "Primary lease document state updated",
    metadata: {
      documentId: params.document.id,
      documentType: params.document.documentType,
      jurisdictionCode: params.document.jurisdictionCode,
      templateVersion: params.document.templateVersion,
      templateEffectiveDate: params.document.templateEffectiveDate,
      counselReviewStatus: params.document.counselReviewStatus,
      sourceReferences: params.document.sourceReferences,
      documentHash: params.document.documentHash,
      manifestHash: params.document.manifestHash,
      status: params.document.status,
    },
  });
}

export async function loadCurrentPrimaryLeaseDocument(input: {
  leaseId: string;
  landlordId: string;
  includeSuperseded?: boolean;
}): Promise<LeaseDocumentMetadata | null> {
  const snap = await db
    .collection(LEASE_DOCUMENTS_COLLECTION)
    .where("leaseId", "==", input.leaseId)
    .where("landlordId", "==", input.landlordId)
    .where("documentType", "==", "primary_lease")
    .get();
  const docs = snap.docs
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as LeaseDocumentMetadata)
    .filter((doc) => input.includeSuperseded || doc.status === "generated" || doc.status === "locked")
    .sort((a, b) => String(b.generatedAt || "").localeCompare(String(a.generatedAt || "")));
  return docs[0] || null;
}

export async function getPrimaryLeaseDocumentSummary(input: {
  leaseId: string;
  landlordId: string;
  includePreviewUrl?: boolean;
}): Promise<LeaseDocumentProjection | null> {
  const doc = await loadCurrentPrimaryLeaseDocument(input);
  if (!doc) return null;
  const previewUrl = input.includePreviewUrl
    ? await getSignedDownloadUrl({ bucket: doc.storageRef.bucket, path: doc.storageRef.path, expiresMinutes: 30 })
    : null;
  return safeProjection(doc, previewUrl);
}

export async function generatePrimaryLeaseDocument(input: PrimaryLeaseDocumentInput): Promise<LeaseDocumentProjection> {
  const leaseId = String(input.leaseId || "").trim();
  const lease = input.lease || {};
  const landlordId = String(lease.landlordId || "").trim();
  if (!leaseId || !landlordId) {
    const error = new Error("lease_document_generation_unavailable") as Error & { status: number };
    error.status = 400;
    throw error;
  }
  const jurisdictionCode = jurisdictionCodeFromLease({ ...input.property, ...lease });
  const adapter = getLeaseDocumentAdapter(jurisdictionCode);
  if (!adapter) {
    const error = new Error("jurisdiction_template_unavailable") as Error & { status: number };
    error.status = 400;
    throw error;
  }
  assertAdapterAllowedForGeneration(adapter);

  const previous = await loadCurrentPrimaryLeaseDocument({ leaseId, landlordId });
  if (previous?.status === "locked") {
    const error = new Error("lease_document_locked") as Error & { status: number };
    error.status = 409;
    throw error;
  }

  const pdfBuffer = await adapter.renderPrimaryLeasePdf(input);
  const documentHash = digest(pdfBuffer);
  const generatedAt = nowIso();
  const tenantIds = tenantIdsFromLease(lease);
  const manifest = manifestFor({
    leaseId,
    landlordId,
    tenantIds,
    jurisdictionCode: adapter.jurisdictionCode,
    templateVersion: adapter.templateVersion,
    documentHash,
    generatedAt,
  });
  const manifestHash = digest(stableJson(manifest));
  const documentId = `ldoc_${digest(`${leaseId}:${documentHash}:${generatedAt}`, 24)}`;
  const objectKey = `lease-documents/${digest(landlordId, 12)}/${digest(leaseId, 12)}/${documentId}.pdf`;
  const uploaded = await putPdfObject({ objectKey, pdfBuffer });
  const storageRef = {
    bucket: uploaded.bucket || process.env.GCS_UPLOAD_BUCKET || "",
    path: uploaded.path || objectKey,
  };
  if (!storageRef.bucket || !storageRef.path) {
    const error = new Error("lease_document_generation_unavailable") as Error & { status: number };
    error.status = 500;
    throw error;
  }

  if (previous) {
    const superseded = { ...previous, status: "superseded" as const, supersededAt: generatedAt, supersededByDocumentId: documentId };
    await db.collection(LEASE_DOCUMENTS_COLLECTION).doc(previous.id).set(superseded, { merge: true });
    await writeLeaseDocumentEvent({
      action: "lease_document_superseded",
      status: "superseded",
      leaseId,
      landlordId,
      actorId: input.actorId || null,
      document: superseded,
    });
  }

  const document: LeaseDocumentMetadata = {
    id: documentId,
    leaseId,
    landlordId,
    tenantIds,
    documentType: "primary_lease",
    jurisdictionCode: adapter.jurisdictionCode,
    templateVersion: adapter.templateVersion,
    templateEffectiveDate: adapter.effectiveDate,
    counselReviewStatus: adapter.counselReviewStatus,
    sourceReferences: adapter.sourceReferences,
    generatedAt,
    generatedBy: input.actorId || null,
    documentHash,
    manifestHash,
    storageRef,
    providerAccessUrlExpiresAt: null,
    status: "generated",
    lockedAt: null,
    lockedBy: null,
    signingRequestId: null,
    sourceSummary: {
      adapterStatus: adapter.counselReviewStatus,
      signingEnabled: adapter.signingEnabled,
      productionApproved: adapter.productionApproved,
      templateEffectiveDate: adapter.effectiveDate,
      sourceReferences: adapter.sourceReferences,
    },
  };
  await db.collection(LEASE_DOCUMENTS_COLLECTION).doc(documentId).set({
    ...document,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeLeaseDocumentEvent({
    action: "lease_document_generated",
    status: "generated",
    leaseId,
    landlordId,
    actorId: input.actorId || null,
    document,
  });
  return safeProjection(document);
}

export async function lockPrimaryLeaseDocumentForSigning(input: {
  leaseId: string;
  landlordId: string;
  actorId?: string | null;
  signingRequestId?: string | null;
}): Promise<{ document: LeaseDocumentMetadata; providerDocumentUrl: string }> {
  const document = await loadCurrentPrimaryLeaseDocument({ leaseId: input.leaseId, landlordId: input.landlordId });
  if (!document || document.status === "superseded" || document.status === "expired") {
    const error = new Error("signing_document_url_required") as Error & { status: number };
    error.status = 400;
    throw error;
  }
  assertAdapterAllowedForSigning(document.sourceSummary || {});

  const providerDocumentUrl = await getSignedDownloadUrl({
    bucket: document.storageRef.bucket,
    path: document.storageRef.path,
    expiresMinutes: PROVIDER_ACCESS_MINUTES,
  });
  const lockedAt = nowIso();
  const providerAccessUrlExpiresAt = new Date(Date.now() + PROVIDER_ACCESS_MINUTES * 60 * 1000).toISOString();
  const next: LeaseDocumentMetadata = {
    ...document,
    status: "locked",
    lockedAt: document.lockedAt || lockedAt,
    lockedBy: document.lockedBy || input.actorId || input.landlordId,
    signingRequestId: input.signingRequestId || document.signingRequestId || null,
    providerAccessUrlExpiresAt,
  };
  await db.collection(LEASE_DOCUMENTS_COLLECTION).doc(document.id).set(
    {
      status: next.status,
      lockedAt: next.lockedAt,
      lockedBy: next.lockedBy,
      signingRequestId: next.signingRequestId,
      providerAccessUrlExpiresAt,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  if (document.status !== "locked") {
    await writeLeaseDocumentEvent({
      action: "lease_document_locked",
      status: "locked",
      leaseId: input.leaseId,
      landlordId: input.landlordId,
      actorId: input.actorId || null,
      document: next,
    });
  }
  return { document: next, providerDocumentUrl };
}
