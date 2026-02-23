import { apiJson } from "@/api/http";

export type LeaseTermType = "fixed" | "month-to-month" | "year-to-year";

export interface LeaseDraftPayload {
  propertyId: string;
  unitId: string;
  tenantIds: string[];
  province: "NS";
  termType: LeaseTermType;
  startDate: string;
  endDate?: string | null;
  baseRentCents: number;
  parkingCents: number;
  dueDay: number;
  paymentMethod: string;
  nsfFeeCents?: number | null;
  utilitiesIncluded: string[];
  depositCents?: number | null;
  additionalClauses: string;
}

export interface LeaseDraftRecord extends LeaseDraftPayload {
  id: string;
  landlordId: string;
  status: "draft" | "generated";
  templateVersion: "ns-schedule-a-v1";
  createdAt: number;
  updatedAt: number;
}

export interface LeaseSnapshotRecord extends LeaseDraftRecord {
  generatedAt: number;
  generatedFiles: Array<{
    kind: string;
    url: string;
    sha256: string;
    sizeBytes: number;
  }>;
}

export async function createLeaseDraft(payload: LeaseDraftPayload) {
  return apiJson<{ ok: true; draftId: string; draft: LeaseDraftRecord }>("/leases/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getLeaseDraft(draftId: string) {
  return apiJson<{ ok: true; draft: LeaseDraftRecord }>(`/leases/drafts/${encodeURIComponent(draftId)}`);
}

export async function updateLeaseDraft(draftId: string, patch: Partial<LeaseDraftPayload>) {
  return apiJson<{ ok: true; draft: LeaseDraftRecord }>(`/leases/drafts/${encodeURIComponent(draftId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function generateLeaseDraftPdf(
  draftId: string,
  context?: { tenantNames?: string[]; propertyAddress?: string; unitLabel?: string }
) {
  return apiJson<{
    ok: true;
    snapshotId: string;
    scheduleAUrl: string;
    generatedFiles: Array<{ kind: string; url: string; sha256: string; sizeBytes: number }>;
  }>(`/leases/drafts/${encodeURIComponent(draftId)}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(context || {}),
  });
}

export async function getLeaseSnapshot(snapshotId: string) {
  return apiJson<{ ok: true; snapshot: LeaseSnapshotRecord }>(
    `/leases/snapshots/${encodeURIComponent(snapshotId)}`
  );
}
