import { apiJson } from "../lib/apiClient";

export type VerifiedScreeningQueueItem = {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: "QUEUED" | "IN_PROGRESS" | "COMPLETE" | "CANCELLED";
  serviceLevel: "VERIFIED" | "VERIFIED_AI";
  landlordId: string;
  applicationId: string;
  orderId: string;
  propertyId: string;
  unitId: string | null;
  applicant: { name: string; email: string };
  aiIncluded: boolean;
  scoreAddOn: boolean;
  totalAmountCents: number;
  currency: string;
  notesInternal: string | null;
  reviewer: { email?: string | null } | null;
  completedAt: number | null;
  resultSummary: string | null;
  recommendation: "APPROVE" | "DECLINE" | "CONDITIONAL" | null;
};

export async function listVerifiedScreenings(): Promise<VerifiedScreeningQueueItem[]> {
  const res = await apiJson<{ ok: boolean; data: VerifiedScreeningQueueItem[] }>(
    "/admin/verified-screenings"
  );
  return res?.data || [];
}

export async function fetchVerifiedScreening(id: string): Promise<VerifiedScreeningQueueItem> {
  const res = await apiJson<{ ok: boolean; data: VerifiedScreeningQueueItem }>(
    `/admin/verified-screenings/${encodeURIComponent(id)}`
  );
  return res.data;
}

export async function updateVerifiedScreening(
  id: string,
  payload: Partial<Pick<
    VerifiedScreeningQueueItem,
    "status" | "notesInternal" | "resultSummary" | "recommendation"
  >>
): Promise<VerifiedScreeningQueueItem> {
  const res = await apiJson<{ ok: boolean; data: VerifiedScreeningQueueItem }>(
    `/admin/verified-screenings/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  return res.data;
}
