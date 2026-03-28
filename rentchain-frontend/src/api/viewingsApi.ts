import { apiFetch } from "./apiFetch";

export type ViewingRequestStatus =
  | "requested"
  | "slots_proposed"
  | "scheduled"
  | "completed"
  | "cancelled";

export type ViewingSlot = {
  id: string;
  startAt: string;
  endAt: string;
  note?: string | null;
  isSelected?: boolean;
};

export type ViewingRequest = {
  id: string;
  landlordId: string;
  propertyId: string | null;
  unitId: string | null;
  applicationId: string | null;
  applicantName: string | null;
  applicantEmail: string | null;
  applicantPhone: string | null;
  requestedMessage: string | null;
  status: ViewingRequestStatus;
  proposedSlots: ViewingSlot[];
  selectedSlotId?: string | null;
  selectedSlot?: {
    id: string;
    startAt: string;
    endAt: string;
    note?: string | null;
  } | null;
  requestedAt: string;
  slotsProposedAt?: string | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByUserId?: string | null;
};

export type CreateViewingRequestPayload = {
  propertyId?: string | null;
  unitId?: string | null;
  applicationId?: string | null;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string | null;
  requestedMessage?: string | null;
};

export type ProposedViewingSlotPayload = {
  id: string;
  startAt: string;
  endAt: string;
  note?: string | null;
};

export async function createViewingRequest(
  payload: CreateViewingRequestPayload
): Promise<ViewingRequest> {
  return apiFetch<ViewingRequest>("/viewings/request", {
    method: "POST",
    body: payload,
  });
}

export async function fetchViewingRequests(): Promise<ViewingRequest[]> {
  return apiFetch<ViewingRequest[]>("/viewings");
}

export async function fetchViewingRequest(viewingRequestId: string): Promise<ViewingRequest> {
  return apiFetch<ViewingRequest>(`/viewings/${encodeURIComponent(viewingRequestId)}`);
}

export async function proposeViewingSlots(
  viewingRequestId: string,
  payload: { proposedSlots: ProposedViewingSlotPayload[] }
): Promise<ViewingRequest> {
  return apiFetch<ViewingRequest>(`/viewings/${encodeURIComponent(viewingRequestId)}/propose-slots`, {
    method: "POST",
    body: payload,
  });
}

export async function selectViewingSlot(
  viewingRequestId: string,
  payload: { slotId: string }
): Promise<ViewingRequest> {
  return apiFetch<ViewingRequest>(`/viewings/${encodeURIComponent(viewingRequestId)}/select-slot`, {
    method: "POST",
    body: payload,
  });
}

export async function completeViewing(viewingRequestId: string): Promise<ViewingRequest> {
  return apiFetch<ViewingRequest>(`/viewings/${encodeURIComponent(viewingRequestId)}/complete`, {
    method: "POST",
    body: {},
  });
}

export async function cancelViewing(
  viewingRequestId: string,
  payload: { cancelledReason?: string | null }
): Promise<ViewingRequest> {
  return apiFetch<ViewingRequest>(`/viewings/${encodeURIComponent(viewingRequestId)}/cancel`, {
    method: "POST",
    body: payload,
  });
}
