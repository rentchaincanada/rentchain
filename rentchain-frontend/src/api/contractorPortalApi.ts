import { apiFetch } from "./apiFetch";

export type ContractorPortalProfile = {
  id: string;
  name?: string | null;
  businessName?: string | null;
  email?: string | null;
  phone?: string | null;
  specialties?: string[];
  serviceAreas?: string[];
  availability?: string | null;
  bio?: string | null;
};

export type ContractorPortalWorkOrder = {
  id: string;
  workOrderId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  dueDate?: number | null;
  property?: { label?: string | null; slug?: string | null };
  unit?: { label?: string | null };
  landlord?: { name?: string | null; email?: string | null };
  statusHistory?: Array<{ id: string; type: string; message?: string | null; createdAt?: number | null }>;
  messages?: ContractorPortalMessage[];
};

export type ContractorPortalMessage = {
  id: string;
  workOrderId: string;
  landlordId?: string | null;
  senderRole?: string | null;
  senderName?: string | null;
  text: string;
  createdAt?: number | null;
};

function contractorPath(contractorId: string, path: string) {
  return `/contractors/${encodeURIComponent(contractorId)}${path}`;
}

export async function listContractorPortalWorkOrders(contractorId: string, status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await apiFetch<{ ok: boolean; items: ContractorPortalWorkOrder[] }>(
    contractorPath(contractorId, `/work-orders${query}`),
    { method: "GET" }
  );
  return Array.isArray(res?.items) ? res.items : [];
}

export async function getContractorPortalWorkOrder(contractorId: string, workOrderId: string) {
  const res = await apiFetch<{ ok: boolean; item: ContractorPortalWorkOrder }>(
    contractorPath(contractorId, `/work-orders/${encodeURIComponent(workOrderId)}`),
    { method: "GET" }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to load contractor work order");
  return res.item;
}

export async function updateContractorPortalWorkOrderStatus(
  contractorId: string,
  workOrderId: string,
  payload: { status: string; message?: string }
) {
  const res = await apiFetch<{ ok: boolean; item: ContractorPortalWorkOrder }>(
    contractorPath(contractorId, `/work-orders/${encodeURIComponent(workOrderId)}/status`),
    { method: "PATCH", body: payload }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to update contractor work order");
  return res.item;
}

export async function listContractorPortalMessages(contractorId: string, workOrderId?: string) {
  const query = workOrderId ? `?workOrderId=${encodeURIComponent(workOrderId)}` : "";
  const res = await apiFetch<{ ok: boolean; items: ContractorPortalMessage[] }>(
    contractorPath(contractorId, `/messages${query}`),
    { method: "GET" }
  );
  return Array.isArray(res?.items) ? res.items : [];
}

export async function sendContractorPortalMessage(
  contractorId: string,
  payload: { landlordId: string; workOrderId: string; text: string }
) {
  const res = await apiFetch<{ ok: boolean; message: ContractorPortalMessage }>(
    contractorPath(contractorId, "/messages"),
    { method: "POST", body: payload }
  );
  if (!res?.ok || !res.message) throw new Error("Failed to send contractor message");
  return res.message;
}

export async function getContractorPortalProfile(contractorId: string) {
  const res = await apiFetch<{ ok: boolean; profile: ContractorPortalProfile | null }>(
    contractorPath(contractorId, "/profile"),
    { method: "GET" }
  );
  return res?.profile || null;
}

export async function updateContractorPortalProfile(contractorId: string, payload: Partial<ContractorPortalProfile>) {
  const res = await apiFetch<{ ok: boolean; profile: ContractorPortalProfile }>(
    contractorPath(contractorId, "/profile"),
    { method: "PATCH", body: payload }
  );
  if (!res?.ok || !res.profile) throw new Error("Failed to update contractor profile");
  return res.profile;
}
