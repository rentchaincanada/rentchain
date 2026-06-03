import { db } from "../../firebase";
import type {
  ContractorAvailabilityStatus,
  ContractorProfileV1,
  ContractorServiceCategory,
} from "./contractorTypes";

const CONTRACTOR_SERVICE_CATEGORIES = new Set<ContractorServiceCategory>([
  "plumbing",
  "electrical",
  "hvac",
  "general_maintenance",
  "cleaning",
  "painting",
  "locksmith",
  "appliance_repair",
]);

const AVAILABILITY_STATUSES = new Set<ContractorAvailabilityStatus>(["active", "inactive", "limited"]);

function asString(value: unknown, max = 400) {
  return String(value || "").trim().slice(0, max);
}

function asOptionalString(value: unknown, max = 400) {
  const next = asString(value, max);
  return next || null;
}

function uniqueStrings(input: unknown, max = 50) {
  if (!Array.isArray(input)) return [];
  const next = new Set<string>();
  for (const value of input) {
    const normalized = asString(value, 120);
    if (!normalized) continue;
    next.add(normalized);
    if (next.size >= max) break;
  }
  return Array.from(next);
}

function toIsoString(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof (value as any)?.toMillis === "function") {
    return new Date((value as any).toMillis()).toISOString();
  }
  if (typeof (value as any)?.seconds === "number") {
    return new Date((value as any).seconds * 1000).toISOString();
  }
  return new Date(0).toISOString();
}

function normalizeServiceCategories(input: unknown): ContractorServiceCategory[] {
  const values = uniqueStrings(input, 20).map((value) => value.toLowerCase().replace(/\s+/g, "_"));
  return values.filter((value): value is ContractorServiceCategory => CONTRACTOR_SERVICE_CATEGORIES.has(value as ContractorServiceCategory));
}

function normalizeAvailability(value: unknown): ContractorAvailabilityStatus {
  const normalized = asString(value, 40).toLowerCase();
  return AVAILABILITY_STATUSES.has(normalized as ContractorAvailabilityStatus)
    ? (normalized as ContractorAvailabilityStatus)
    : "active";
}

function deriveDisplayName(data: any) {
  return (
    asString(data?.displayName, 180) ||
    asString(data?.contactName, 180) ||
    asString(data?.businessName, 180) ||
    asString(data?.email, 120).split("@")[0] ||
    "Contractor"
  );
}

export function normalizeContractorProfile(docId: string, data: any): ContractorProfileV1 {
  const landlordNetworkIds = uniqueStrings(
    data?.metadata?.landlordNetworkIds ?? data?.landlordNetworkIds ?? data?.invitedByLandlordIds,
    100
  );
  const createdAt = toIsoString(data?.createdAt ?? data?.createdAtMs ?? Date.now());
  const updatedAt = toIsoString(data?.updatedAt ?? data?.updatedAtMs ?? data?.createdAtMs ?? Date.now());
  return {
    version: "v1",
    id: asString(data?.id, 120) || docId,
    userId: asOptionalString(data?.userId, 120),
    displayName: deriveDisplayName(data),
    businessName: asOptionalString(data?.businessName, 180),
    serviceCategories: normalizeServiceCategories(data?.serviceCategories),
    serviceAreas: uniqueStrings(data?.serviceAreas, 50),
    availabilityStatus: normalizeAvailability(data?.availabilityStatus ?? (data?.isActive === false ? "inactive" : "active")),
    contact: {
      email: asOptionalString(data?.contact?.email ?? data?.email, 320),
      phone: asOptionalString(data?.contact?.phone ?? data?.phone, 80),
    },
    summary: asOptionalString(data?.summary ?? data?.bio, 2000),
    metadata: {
      internalNotes: asOptionalString(data?.metadata?.internalNotes, 2000),
      landlordNetworkIds,
      createdByLandlordId: asOptionalString(data?.metadata?.createdByLandlordId, 120),
    },
    createdAt,
    updatedAt,
  };
}

export async function loadContractorProfilesForActor(input: {
  role: "admin" | "landlord";
  landlordId?: string | null;
}) {
  const snap = await db.collection("contractorProfiles").limit(500).get();
  const items = snap.docs.map((doc) => normalizeContractorProfile(doc.id, doc.data()));
  if (input.role === "admin") return items;
  const landlordId = asString(input.landlordId, 120);
  if (!landlordId) return [];
  return items.filter((item) => {
    const networkIds = Array.isArray(item.metadata?.landlordNetworkIds) ? item.metadata?.landlordNetworkIds : [];
    return networkIds.includes(landlordId) || item.metadata?.createdByLandlordId === landlordId;
  });
}
